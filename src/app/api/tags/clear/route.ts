import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { tags, type NewTag } from "@/db/schema";

// GET - 获取所有标签或搜索标签
export async function GET(request: NextRequest) {
  const db = await getDb();
  const result = await db.delete(tags);

  return NextResponse.json({
    success: true,
    message: "标签已清除",
    data: result,
  });
}