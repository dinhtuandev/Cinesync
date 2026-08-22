import { NextRequest, NextResponse } from "next/server";
import { searchMovies } from "@/lib/server-api";

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get("keyword") ?? "";
  if (keyword.trim().length < 2) {
    return NextResponse.json(
      { success: false, message: "Từ khóa tìm kiếm phải có tối thiểu 2 ký tự" },
      { status: 400 },
    );
  }
  try {
    const items = await searchMovies(keyword);
    return NextResponse.json({ success: true, message: "", data: { items } });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Không thể tải dữ liệu phim lúc này, vui lòng thử lại sau",
      },
      { status: 502 },
    );
  }
}
