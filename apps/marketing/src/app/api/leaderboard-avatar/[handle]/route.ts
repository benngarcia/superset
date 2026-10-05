import { robotSvg } from "@/app/[lang]/utils/avatarUrl/robotSvg";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ handle: string }> },
) {
	const { handle } = await params;
	return new Response(robotSvg(handle), {
		headers: {
			"Content-Type": "image/svg+xml",
			"Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
			"X-Content-Type-Options": "nosniff",
		},
	});
}
