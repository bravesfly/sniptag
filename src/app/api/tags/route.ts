import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { tags, type NewTag } from "@/db/schema";
import { eq, like } from "drizzle-orm";
import { ApiResponse, Tag } from "@/types";

// GET - 获取所有标签或搜索标签
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const result = search 
      ? await db.select().from(tags).where(like(tags.name, `%${search}%`))
      : await db.select().from(tags);
    
    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("获取标签失败:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "获取标签失败" 
      },
      { status: 500 }
    );
  }
}

// POST - 创建新标签
// export async function POST(request: NextRequest) {
//   try {
//     const db = getDB();
//     const body: Omit<NewTag, "id" | "createdAt" | "updatedAt"> = await request.json();

//     // 验证必需字段
//     if (!body.name?.trim()) {
//       return NextResponse.json(
//         { 
//           success: false, 
//           error: "标签名称不能为空" 
//         },
//         { status: 400 }
//       );
//     }

//     const newTag: NewTag = {
//       name: body.name.trim(),
//       color: body.color || null,
//       createdAt: new Date(),
//       updatedAt: new Date(),
//     };

//     const result = await db.insert(tags).values(newTag).returning();
    
//     return NextResponse.json({
//       success: true,
//       data: result[0]
//     }, { status: 201 });
//   } catch (error: any) {
//     console.error("创建标签失败:", error);
    
//     // 处理唯一约束错误
//     if (error.message?.includes("UNIQUE")) {
//       return NextResponse.json(
//         { 
//           success: false, 
//           error: "标签名称已存在" 
//         },
//         { status: 409 }
//       );
//     }
    
//     return NextResponse.json(
//       { 
//         success: false, 
//         error: "创建标签失败" 
//       },
//       { status: 500 }
//     );
//   }
// }

// PUT - 更新标签
export async function PUT(request: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json(
        { 
          success: false, 
          error: "缺少标签 ID" 
        },
        { status: 400 }
      );
    }

    const body: Partial<NewTag> = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { 
          success: false, 
          error: "标签名称不能为空" 
        },
        { status: 400 }
      );
    }

    const updateData = {
      name: body.name.trim(),
      color: body.color || null,
      updatedAt: new Date(),
    };

    const result = await db
      .update(tags)
      .set(updateData)
      .where(eq(tags.id, parseInt(id)))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: "标签不存在" 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result[0]
    });
  } catch (error: any) {
    console.error("更新标签失败:", error);
    
    if (error.message?.includes("UNIQUE")) {
      return NextResponse.json(
        { 
          success: false, 
          error: "标签名称已存在" 
        },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: "更新标签失败" 
      },
      { status: 500 }
    );
  }
}

// DELETE - 删除标签
export async function DELETE(request: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json(
        { 
          success: false, 
          error: "缺少标签 ID" 
        },
        { status: 400 }
      );
    }

    const result = await db
      .delete(tags)
      .where(eq(tags.id, parseInt(id)))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: "标签不存在" 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "标签删除成功"
    });
  } catch (error) {
    console.error("删除标签失败:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "删除标签失败" 
      },
      { status: 500 }
    );
  }
} 