export async function POST() {
  return new Response(JSON.stringify({ message: 'Error logged' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function GET() {
  return new Response(JSON.stringify({ errors: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}