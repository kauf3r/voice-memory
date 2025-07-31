'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../components/AuthProvider'
import { PinnedTasksProvider, usePinnedTasks } from '../components/PinnedTasksProvider'

function SimpleKnowledgePageContent() {
  // Call ALL hooks at the very top, unconditionally
  const { user, loading: authLoading } = useAuth()
  const [knowledge, setKnowledge] = useState(null)
  const [loading, setLoading] = useState(true)
  const { isPinned, pinTask, unpinTask } = usePinnedTasks()

  useEffect(() => {
    console.log('Effect running')
  }, [user])

  // NO early returns - render everything conditionally instead
  let content
  if (authLoading) {
    content = <div>Loading auth...</div>
  } else if (!user) {
    content = <div>Please log in</div>
  } else if (loading) {
    content = <div>Loading knowledge...</div>
  } else {
    content = <div>Knowledge content would go here</div>
  }

  return content
}

export default function SimpleKnowledgePage() {
  return (
    <PinnedTasksProvider>
      <SimpleKnowledgePageContent />
    </PinnedTasksProvider>
  )
}