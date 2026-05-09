export async function GET() {
  return Response.json({
    name: 'offer360-web',
    status: 'ok',
    time: new Date().toISOString(),
  });
}
