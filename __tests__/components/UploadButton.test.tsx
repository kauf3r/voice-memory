import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UploadButton from '@/app/components/UploadButton'
import { useAuth } from '@/app/components/AuthProvider'
import { configureMockClient, mockData } from '@supabase/supabase-js'

// Mock dependencies
jest.mock('@/app/components/AuthProvider')
jest.mock('@/lib/storage')
jest.mock('@/lib/supabase', () => ({
  supabase: null // Will be set by configureMockClient
}))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

describe('UploadButton', () => {
  let mockSupabase: any
  let mockFetch: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock authenticated user
    mockUseAuth.mockReturnValue({
      user: mockData.user,
      loading: false,
      signInWithEmail: jest.fn(),
      signOut: jest.fn(),
    })

    // Configure Supabase mock
    mockSupabase = configureMockClient({ authenticated: true })
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'mock-token', user: mockData.user } },
      error: null
    })

    // Mock fetch for upload API
    mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, url: 'https://example.com/audio.mp3' })
    } as Response)

    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    mockFetch.mockRestore()
    jest.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('should render upload button with correct text', () => {
      render(<UploadButton />)
      
      expect(screen.getByText('Upload audio files')).toBeInTheDocument()
      expect(screen.getByText(/Supports MP3, WAV, M4A, AAC, OGG/)).toBeInTheDocument()
      expect(screen.getByText(/max 25MB each/)).toBeInTheDocument()
    })

    it('should render file input with correct attributes', () => {
      render(<UploadButton />)
      
      const fileInput = screen.getByRole('textbox', { hidden: true }) || 
                       document.querySelector('input[type="file"]')
      
      expect(fileInput).toBeInTheDocument()
      expect(fileInput).toHaveAttribute('type', 'file')
      expect(fileInput).toHaveAttribute('multiple')
      expect(fileInput).toHaveAttribute('accept')
    })

    it('should apply custom className', () => {
      render(<UploadButton className="custom-class" />)
      
      const uploadArea = screen.getByText('Upload audio files').closest('div')
      expect(uploadArea).toHaveClass('custom-class')
    })

    it('should handle single file mode', () => {
      render(<UploadButton multiple={false} />)
      
      const fileInput = screen.getByRole('textbox', { hidden: true }) || 
                       document.querySelector('input[type="file"]')
      
      expect(fileInput).not.toHaveAttribute('multiple')
    })
  })

  describe('File Validation', () => {
    const createMockFile = (name: string, type: string, size: number = 1024) => {
      return new File(['test content'], name, { type, size })
    }

    it('should accept valid audio files', async () => {
      const validFormats = [
        { name: 'test.mp3', type: 'audio/mpeg' },
        { name: 'test.wav', type: 'audio/wav' },
        { name: 'test.m4a', type: 'audio/mp4' },
        { name: 'test.aac', type: 'audio/aac' },
        { name: 'test.ogg', type: 'audio/ogg' },
      ]

      for (const format of validFormats) {
        const file = createMockFile(format.name, format.type)
        
        render(<UploadButton />)
        
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
        
        await act(async () => {
          fireEvent.change(fileInput, { target: { files: [file] } })
        })

        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalled()
        })

        // Clean up for next iteration
        mockFetch.mockClear()
      }
    })

    it('should accept M4A files regardless of MIME type', async () => {
      const m4aFile = createMockFile('test.m4a', 'audio/x-m4a') // Non-standard MIME type
      
      render(<UploadButton />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [m4aFile] } })
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })

    it('should reject files that are too large', async () => {
      const largeFile = createMockFile('large.mp3', 'audio/mpeg', 26 * 1024 * 1024) // 26MB
      
      render(<UploadButton />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [largeFile] } })
      })

      await waitFor(() => {
        expect(screen.getByText(/File size.*exceeds the 25MB limit/)).toBeInTheDocument()
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should reject unsupported file types', async () => {
      const textFile = createMockFile('document.txt', 'text/plain')
      
      render(<UploadButton />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [textFile] } })
      })

      await waitFor(() => {
        expect(screen.getByText(/File type.*is not supported/)).toBeInTheDocument()
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should validate multiple files', async () => {
      const validFile = createMockFile('test.mp3', 'audio/mpeg')
      const invalidFile = createMockFile('document.txt', 'text/plain')
      
      render(<UploadButton />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [validFile, invalidFile] } })
      })

      // Should show error for invalid file
      await waitFor(() => {
        expect(screen.getByText(/File type.*is not supported/)).toBeInTheDocument()
      })

      // Should still upload the valid file
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Upload Process', () => {
    const validFile = new File(['test content'], 'test.mp3', { type: 'audio/mpeg' })

    it('should upload file successfully', async () => {
      const onUploadComplete = jest.fn()
      const onUploadStart = jest.fn()
      
      render(
        <UploadButton 
          onUploadComplete={onUploadComplete}
          onUploadStart={onUploadStart}
        />
      )
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [validFile] } })
      })

      expect(onUploadStart).toHaveBeenCalledWith(validFile)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/upload', {
          method: 'POST',
          body: expect.any(FormData),
          headers: {
            'Authorization': 'Bearer mock-token'
          },
          signal: expect.any(AbortSignal)
        })
      })

      await waitFor(() => {
        expect(onUploadComplete).toHaveBeenCalled()
      })
    })

    it('should show loading state during upload', async () => {
      // Mock slow upload
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true })
          } as Response), 1000)
        )
      )

      render(<UploadButton />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [validFile] } })
      })

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText(/Uploading/)).toBeInTheDocument()
      })
    })

    it('should show progress during upload', async () => {
      // Mock upload with delay
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true })
          } as Response), 500)
        )
      )

      render(<UploadButton />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [validFile] } })
      })

      // Should show progress indicators
      await waitFor(() => {
        expect(screen.getByText(/Uploading/)).toBeInTheDocument()
      })
    })

    it('should handle upload errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Upload failed' })
      } as Response)

      render(<UploadButton />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [validFile] } })
      })

      await waitFor(() => {
        expect(screen.getByText(/Upload failed/)).toBeInTheDocument()
      })
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      render(<UploadButton />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [validFile] } })
      })

      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument()
      })
    })

    it('should handle upload timeout', async () => {
      mockFetch.mockImplementation(() => 
        new Promise((resolve, reject) => {
          setTimeout(() => {
            const error = new Error('Upload timeout')
            error.name = 'AbortError'
            reject(error)
          }, 100)
        })
      )

      render(<UploadButton />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [validFile] } })
      })

      await waitFor(() => {
        expect(screen.getByText(/Upload timed out/)).toBeInTheDocument()
      })
    })

    it('should require authentication', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signInWithEmail: jest.fn(),
        signOut: jest.fn(),
      })

      render(<UploadButton />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [validFile] } })
      })

      await waitFor(() => {
        expect(screen.getByText(/You must be logged in/)).toBeInTheDocument()
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle missing session', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      render(<UploadButton />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [validFile] } })
      })

      await waitFor(() => {
        expect(screen.getByText(/No active session/)).toBeInTheDocument()
      })
    })
  })

  describe('Drag and Drop', () => {
    const validFile = new File(['test content'], 'test.mp3', { type: 'audio/mpeg' })

    it('should handle drag enter', async () => {
      render(<UploadButton />)
      
      const dropZone = screen.getByText('Upload audio files').closest('div')
      
      fireEvent.dragEnter(dropZone!, {
        dataTransfer: {
          files: [validFile],
          types: ['Files']
        }
      })

      expect(dropZone).toHaveClass('border-blue-500')
    })

    it('should handle drag leave', async () => {
      render(<UploadButton />)
      
      const dropZone = screen.getByText('Upload audio files').closest('div')
      
      fireEvent.dragEnter(dropZone!, {
        dataTransfer: {
          files: [validFile],
          types: ['Files']
        }
      })

      fireEvent.dragLeave(dropZone!)

      expect(dropZone).not.toHaveClass('border-blue-500')
    })

    it('should handle file drop', async () => {
      const onUploadStart = jest.fn()
      
      render(<UploadButton onUploadStart={onUploadStart} />)
      
      const dropZone = screen.getByText('Upload audio files').closest('div')
      
      await act(async () => {
        fireEvent.drop(dropZone!, {
          dataTransfer: {
            files: [validFile],
            types: ['Files']
          }
        })
      })

      expect(onUploadStart).toHaveBeenCalledWith(validFile)
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })

    it('should prevent default drag behaviors', () => {
      render(<UploadButton />)
      
      const dropZone = screen.getByText('Upload audio files').closest('div')
      
      const dragOverEvent = new Event('dragover', { cancelable: true })
      const preventDefaultSpy = jest.spyOn(dragOverEvent, 'preventDefault')
      
      fireEvent(dropZone!, dragOverEvent)
      
      expect(preventDefaultSpy).toHaveBeenCalled()
    })
  })

  describe('User Interactions', () => {
    it('should trigger file input when clicked', async () => {
      render(<UploadButton />)
      
      const uploadButton = screen.getByRole('button')
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      const clickSpy = jest.spyOn(fileInput, 'click')
      
      fireEvent.click(uploadButton)
      
      expect(clickSpy).toHaveBeenCalled()
    })

    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup()
      
      render(<UploadButton />)
      
      const uploadButton = screen.getByRole('button')
      
      await user.tab()
      expect(uploadButton).toHaveFocus()
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const clickSpy = jest.spyOn(fileInput, 'click')
      
      await user.keyboard('{Enter}')
      
      expect(clickSpy).toHaveBeenCalled()
    })
  })

  describe('Error Display', () => {
    it('should show and hide error messages', async () => {
      const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' })
      const validFile = new File(['content'], 'test.mp3', { type: 'audio/mpeg' })
      
      render(<UploadButton />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      // Show error for invalid file
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [invalidFile] } })
      })

      await waitFor(() => {
        expect(screen.getByText(/File type.*is not supported/)).toBeInTheDocument()
      })

      // Error should clear with valid file
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [validFile] } })
      })

      await waitFor(() => {
        expect(screen.queryByText(/File type.*is not supported/)).not.toBeInTheDocument()
      })
    })

    it('should display upload progress for multiple files', async () => {
      const file1 = new File(['content1'], 'test1.mp3', { type: 'audio/mpeg' })
      const file2 = new File(['content2'], 'test2.mp3', { type: 'audio/mpeg' })
      
      // Mock slower upload for progress visibility
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true })
          } as Response), 300)
        )
      )

      render(<UploadButton />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file1, file2] } })
      })

      // Should show uploading state
      await waitFor(() => {
        expect(screen.getByText(/Uploading/)).toBeInTheDocument()
      })
    })
  })
})