export async function POST() {
  return new Response(JSON.stringify({ message: 'Metrics recorded' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function GET() {
  return new Response(JSON.stringify({ metrics: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}