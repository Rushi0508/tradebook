import { getLatestSnapshot } from "@/lib/market/bhavcopy"

export async function GET() {
  try {
    return Response.json(await getLatestSnapshot())
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load market data" },
      { status: 502 }
    )
  }
}
