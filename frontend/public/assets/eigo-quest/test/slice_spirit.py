import os
from PIL import Image

# ==================== 配置区域 ====================
# 请确保输入的图片命名为 'fie_spec.png' 并放在同一目录下
SOURCE_IMAGE = "fie_spec.png" 
OUTPUT_DIR = "./public/assets/eigo-quest/spirit_assets/layered/"

# 创建输出目录
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 打开原图并转为 RGBA 模式（确保透明度）
try:
    img = Image.open(SOURCE_IMAGE).convert("RGBA")
    W, H = img.size
    print(f"成功加载原图，分辨率为: {W}x{H}")
except FileNotFoundError:
    print(f"❌ 错误：未找到原图，请将图片重命名为 '{SOURCE_IMAGE}' 并与脚本放在同一文件夹下。")
    exit()

# 💡 核心对齐算法：创建一个512x512画布，将部件粘贴到指定偏移位置
def generate_layer(crop_box, filename, offset=(0, 0)):
    """
    crop_box: (left, top, right, bottom) 占原图的比例 (0.0 ~ 1.0)，自动适应各种分辨率
    offset: (x_offset, y_offset) 基于512x512中心点的微调，用来确保翅膀、眼睛和身体完美对齐
    """
    # 1. 计算绝对像素坐标
    box = (
        int(crop_box[0] * W),
        int(crop_box[1] * H),
        int(crop_box[2] * W),
        int(crop_box[3] * H)
    )
    
    # 2. 裁剪部件并缩放
    cropped = img.crop(box)
    
    # 根据你的需要，这里可以将裁剪出的部件等比例缩放（假设缩放到合适大小）
    # 为了保证清晰度，我们先计算它的目标大小
    part_w, part_h = cropped.size
    scale_factor = 250 / max(part_w, part_h) # 动态缩放比例，让身体主体大约占画布的一半
    new_size = (int(part_w * scale_factor), int(part_h * scale_factor))
    resized_part = cropped.resize(new_size, Image.Resampling.LANCZOS)
    
    # 3. 创建 512x512 透明画布
    canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    
    # 4. 计算居中位置 + 偏移量
    paste_x = (512 - new_size[0]) // 2 + offset[0]
    paste_y = (512 - new_size[1]) // 2 + offset[1]
    
    # 5. 粘贴并保存
    canvas.paste(resized_part, (paste_x, paste_y), resized_part)
    canvas.save(os.path.join(OUTPUT_DIR, filename), "PNG")
    print(f"已生成对齐图层: {filename}")

# ==================== 坐标预设 (基于原图比例) ====================
# 注意：以下比例基于标准排版估算，运行后可根据重叠效果微调 offset 坐标

# 1. Fallback 完整状态图 (直接从 4 STATES 区域裁剪)
generate_layer((0.27, 0.08, 0.45, 0.35), "idle_state.png", offset=(0, 20))
generate_layer((0.45, 0.08, 0.63, 0.35), "talk_state.png", offset=(0, 20))
generate_layer((0.63, 0.08, 0.81, 0.35), "happy_state.png", offset=(0, 20))

# 2. 独立部件图 (从最下方的 PARTS 区域裁剪)
# 主身体 (包含头发衣服)
generate_layer((0.02, 0.84, 0.12, 0.98), "body_main.png", offset=(0, 30))
# 翅膀 (需要相对身体往上往后移一点，这里微调 Y 轴)
generate_layer((0.44, 0.86, 0.53, 0.98), "parts_wings.png", offset=(0, -10))
# 光球 (位于右手前方)
generate_layer((0.54, 0.88, 0.59, 0.96), "parts_orb.png", offset=(-60, 40))
# 叶子特效
generate_layer((0.59, 0.86, 0.67, 0.98), "parts_leaf_fx.png", offset=(0, 20))
# 魔法环特效 (从 ACTIONS 的 くるくる 提取背景特效)
generate_layer((0.41, 0.64, 0.53, 0.80), "parts_faefx.png", offset=(0, 40))

# 3. 动态五官表情 (从中间的脸部区域精确裁剪眼睛和嘴巴，并完美对齐到面部)
# 提示：因为只保留五官，脚本中可以使用颜色通道过滤或者你后续手动擦除脸皮
generate_layer((0.03, 0.46, 0.13, 0.56), "face_normal.png", offset=(0, 0))
generate_layer((0.17, 0.46, 0.27, 0.56), "face_happy.png", offset=(0, 0))
generate_layer((0.58, 0.46, 0.68, 0.56), "face_sad.png", offset=(0, 0))

print("\n🎉 所有分层素材处理完毕！请检查工程目录。")