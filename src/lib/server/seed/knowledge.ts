import type { DB } from "../db";
import { artCategories, artSubcategories, artTechniques } from "../db/schema";
// ---------------------------------------------------------------------------
// Data definitions
// ---------------------------------------------------------------------------

const categoriesData = [
  {
    slug: "composition",
    name: "Composition",
    nameZh: "构图",
    description:
      "How elements are arranged within the frame to create visually pleasing and meaningful images.",
    icon: "grid",
    sortOrder: 0,
  },
  {
    slug: "lighting",
    name: "Lighting",
    nameZh: "光影",
    description:
      "The use of light and shadow to shape mood, depth, and visual interest in an image.",
    icon: "sun",
    sortOrder: 1,
  },
  {
    slug: "color",
    name: "Color",
    nameZh: "色彩",
    description:
      "Color theory and palette choices that set the emotional tone of an image.",
    icon: "palette",
    sortOrder: 2,
  },
  {
    slug: "camera",
    name: "Camera / Angle",
    nameZh: "视角",
    description:
      "Camera position and angle choices that affect perspective, scale, and narrative.",
    icon: "camera",
    sortOrder: 3,
  },
  {
    slug: "atmosphere",
    name: "Atmosphere",
    nameZh: "氛围",
    description:
      "Environmental and weather effects that create immersive moods and settings.",
    icon: "cloud",
    sortOrder: 4,
  },
  {
    slug: "subject-pose",
    name: "Subject / Pose",
    nameZh: "主体/姿势",
    description:
      "Character poses, expressions, and body language that convey emotion and story.",
    icon: "user",
    sortOrder: 5,
  },
] as const;

const subcategoriesData = {
  composition: [
    {
      slug: "rule-of-thirds",
      name: "Rule of Thirds",
      nameZh: "三分法",
      description:
        "Dividing the frame into thirds and placing key elements along the lines or intersections.",
      sortOrder: 0,
    },
    {
      slug: "golden-ratio",
      name: "Golden Ratio",
      nameZh: "黄金比例",
      description:
        "Using the golden spiral or golden section to create naturally harmonious compositions.",
      sortOrder: 1,
    },
    {
      slug: "symmetry",
      name: "Symmetry",
      nameZh: "对称构图",
      description:
        "Balancing elements equally on both sides of the frame for formal, powerful images.",
      sortOrder: 2,
    },
    {
      slug: "leading-lines",
      name: "Leading Lines",
      nameZh: "引导线",
      description:
        "Using natural or architectural lines to guide the viewer's eye through the image.",
      sortOrder: 3,
    },
    {
      slug: "framing",
      name: "Framing",
      nameZh: "框架构图",
      description:
        "Using elements within the scene to create a frame around the subject.",
      sortOrder: 4,
    },
    {
      slug: "negative-space",
      name: "Negative Space",
      nameZh: "留白",
      description:
        "Intentionally leaving large areas of empty space to emphasize the subject.",
      sortOrder: 5,
    },
  ],
  lighting: [
    {
      slug: "directional",
      name: "Directional",
      nameZh: "方向光",
      description:
        "Light coming from a clear, defined direction that creates strong shadows and depth.",
      sortOrder: 0,
    },
    {
      slug: "ambient",
      name: "Ambient",
      nameZh: "环境光",
      description:
        "Soft, non-directional light that fills the scene evenly without harsh shadows.",
      sortOrder: 1,
    },
    {
      slug: "dramatic",
      name: "Dramatic",
      nameZh: "戏剧性光影",
      description:
        "High-contrast lighting with deep shadows that create tension and visual impact.",
      sortOrder: 2,
    },
    {
      slug: "natural",
      name: "Natural",
      nameZh: "自然光",
      description:
        "Sunlight and naturally occurring light sources that feel organic and authentic.",
      sortOrder: 3,
    },
    {
      slug: "studio",
      name: "Studio",
      nameZh: "影棚光",
      description:
        "Controlled, artificial lighting setups commonly used in professional photography.",
      sortOrder: 4,
    },
    {
      slug: "neon-glow",
      name: "Neon / Glow",
      nameZh: "霓虹/发光",
      description:
        "Colored neon and glowing light sources that create vibrant, futuristic atmospheres.",
      sortOrder: 5,
    },
  ],
  color: [
    {
      slug: "warm-tones",
      name: "Warm Tones",
      nameZh: "暖色调",
      description:
        "Color palettes dominated by reds, oranges, and yellows that evoke warmth and comfort.",
      sortOrder: 0,
    },
    {
      slug: "cool-tones",
      name: "Cool Tones",
      nameZh: "冷色调",
      description:
        "Color palettes built around blues, teals, and purples that feel calm or melancholic.",
      sortOrder: 1,
    },
    {
      slug: "monochrome",
      name: "Monochrome",
      nameZh: "单色",
      description:
        "Using a single hue or near-identical tones for a unified, artistic look.",
      sortOrder: 2,
    },
    {
      slug: "complementary",
      name: "Complementary",
      nameZh: "互补色",
      description:
        "Pairing opposite colors on the color wheel for maximum contrast and vibrancy.",
      sortOrder: 3,
    },
    {
      slug: "pastel",
      name: "Pastel",
      nameZh: "粉彩",
      description:
        "Soft, low-saturation colors that create gentle, dreamy aesthetics.",
      sortOrder: 4,
    },
    {
      slug: "saturated",
      name: "Saturated",
      nameZh: "高饱和",
      description:
        "Bold, vivid colors at full intensity for eye-catching, energetic imagery.",
      sortOrder: 5,
    },
  ],
  camera: [
    {
      slug: "eye-level",
      name: "Eye Level",
      nameZh: "平视角度",
      description:
        "Camera at the subject's eye level for a neutral, relatable perspective.",
      sortOrder: 0,
    },
    {
      slug: "low-angle",
      name: "Low Angle",
      nameZh: "低角度",
      description:
        "Camera below the subject looking up, conveying power and grandeur.",
      sortOrder: 1,
    },
    {
      slug: "high-angle",
      name: "High Angle",
      nameZh: "高角度",
      description:
        "Camera above the subject looking down, creating vulnerability or overview.",
      sortOrder: 2,
    },
    {
      slug: "birds-eye",
      name: "Bird's Eye",
      nameZh: "俯瞰",
      description:
        "Directly overhead view that flattens perspective and reveals patterns.",
      sortOrder: 3,
    },
    {
      slug: "dutch-angle",
      name: "Dutch Angle",
      nameZh: "倾斜角度",
      description:
        "Tilted camera that creates diagonal lines for tension and energy.",
      sortOrder: 4,
    },
    {
      slug: "close-up-macro",
      name: "Close-up / Macro",
      nameZh: "特写/微距",
      description:
        "Very tight framing on details, textures, or facial features for intimacy.",
      sortOrder: 5,
    },
  ],
  atmosphere: [
    {
      slug: "fog-mist",
      name: "Fog / Mist",
      nameZh: "雾气",
      description:
        "Atmospheric haze and fog that reduce visibility and add mystery.",
      sortOrder: 0,
    },
    {
      slug: "rain",
      name: "Rain",
      nameZh: "雨天",
      description:
        "Rainfall and wet surfaces that create reflective, moody environments.",
      sortOrder: 1,
    },
    {
      slug: "sunset-golden-hour",
      name: "Sunset / Golden Hour",
      nameZh: "日落/黄金时刻",
      description:
        "The warm, soft light during golden hour and sunset that painters and photographers love.",
      sortOrder: 2,
    },
    {
      slug: "night-dark",
      name: "Night / Dark",
      nameZh: "夜晚/黑暗",
      description:
        "Dark nighttime scenes with limited light sources creating noir or celestial moods.",
      sortOrder: 3,
    },
    {
      slug: "dreamy",
      name: "Dreamy",
      nameZh: "梦幻",
      description:
        "Soft, ethereal atmospheres that feel otherworldly and fantastical.",
      sortOrder: 4,
    },
    {
      slug: "urban",
      name: "Urban",
      nameZh: "都市",
      description:
        "City environments with concrete, glass, and human-made structures.",
      sortOrder: 5,
    },
  ],
  "subject-pose": [
    {
      slug: "portrait",
      name: "Portrait",
      nameZh: "肖像",
      description:
        "Poses focused on the face and upper body for expressive character depictions.",
      sortOrder: 0,
    },
    {
      slug: "action-dynamic",
      name: "Action / Dynamic",
      nameZh: "动作/动态",
      description:
        "Active poses with movement, motion blur, and dynamic energy.",
      sortOrder: 1,
    },
    {
      slug: "sitting",
      name: "Sitting",
      nameZh: "坐姿",
      description:
        "Seated poses ranging from casual to formal, indoor and outdoor settings.",
      sortOrder: 2,
    },
    {
      slug: "standing",
      name: "Standing",
      nameZh: "站姿",
      description:
        "Full-body standing poses that convey confidence, elegance, or attitude.",
      sortOrder: 3,
    },
    {
      slug: "fantasy",
      name: "Fantasy",
      nameZh: "奇幻",
      description:
        "Imaginative poses with fantastical elements, costumes, and surreal compositions.",
      sortOrder: 4,
    },
    {
      slug: "couple-group",
      name: "Couple / Group",
      nameZh: "双人/多人",
      description:
        "Multi-person compositions showing interaction, relationships, and group dynamics.",
      sortOrder: 5,
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Techniques — keyed by subcategory slug
// ---------------------------------------------------------------------------

interface TechniqueDef {
  slug: string;
  name: string;
  nameZh: string;
  description: string;
  promptKeywords: string;
  nlDescription: string;
  weightHint?: number;
  negativeKeywords?: string;
  moodTags: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  sortOrder: number;
}

const techniquesData: Record<string, TechniqueDef[]> = {
  // ── Composition: Rule of Thirds ──────────────────────────────────────
  "rule-of-thirds": [
    {
      slug: "rule-of-thirds-portrait",
      name: "Rule of Thirds Portrait",
      nameZh: "三分法肖像",
      description:
        "Place the subject's eyes or face at the upper third intersection point for a natural, balanced portrait that draws the viewer in.",
      promptKeywords:
        "rule of thirds, off-center subject, balanced composition, subject at thirds intersection",
      nlDescription:
        "composed following the rule of thirds with the subject positioned at a power point intersection for a naturally balanced and engaging frame",
      moodTags: "peaceful, balanced, natural",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "rule-of-thirds-landscape",
      name: "Rule of Thirds Landscape",
      nameZh: "三分法风景",
      description:
        "Position the horizon at the upper or lower third line and place key landscape features at intersection points.",
      promptKeywords:
        "rule of thirds, horizon at third line, landscape composition, balanced scenery",
      nlDescription:
        "arranged with the horizon placed at the upper or lower third line, key landscape features positioned at intersection points for visual harmony",
      negativeKeywords: "centered horizon, symmetrical",
      moodTags: "peaceful, expansive, harmonious",
      difficulty: "beginner",
      sortOrder: 1,
    },
    {
      slug: "rule-of-thirds-negative",
      name: "Off-Center with Negative Space",
      nameZh: "偏心留白构图",
      description:
        "Combine the rule of thirds with generous negative space to create minimalist compositions with strong visual breathing room.",
      promptKeywords:
        "rule of thirds, off-center, negative space, minimalist composition, breathing room",
      nlDescription:
        "positioned off-center at a thirds intersection with expansive negative space surrounding the subject, creating strong minimalist breathing room",
      negativeKeywords: "cluttered, centered",
      moodTags: "minimalist, peaceful, contemplative",
      difficulty: "intermediate",
      sortOrder: 2,
    },
  ],

  // ── Composition: Golden Ratio ────────────────────────────────────────
  "golden-ratio": [
    {
      slug: "golden-spiral-composition",
      name: "Golden Spiral Composition",
      nameZh: "黄金螺旋构图",
      description:
        "Arrange elements along a Fibonacci spiral leading to the focal point, creating a naturally pleasing visual flow.",
      promptKeywords:
        "golden ratio composition, fibonacci spiral, golden section, spiral flow, dynamic balance",
      nlDescription:
        "arranged along a golden fibonacci spiral that naturally draws the eye toward the focal point in a flowing, harmonious visual path",
      moodTags: "elegant, harmonious, flowing",
      difficulty: "intermediate",
      sortOrder: 0,
    },
    {
      slug: "phi-grid-portrait",
      name: "Phi Grid Portrait",
      nameZh: "黄金分割肖像",
      description:
        "Use the golden ratio grid instead of the rule of thirds for a more refined, classically balanced portrait composition.",
      promptKeywords:
        "golden ratio, phi grid, classical composition, refined framing, subject at golden point",
      nlDescription:
        "framed using the golden ratio phi grid with the subject placed at a golden section intersection for classically refined balance",
      moodTags: "elegant, classical, refined",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "golden-proportion-landscape",
      name: "Golden Proportion Landscape",
      nameZh: "黄金比例风景",
      description:
        "Apply golden ratio divisions to landscape elements for a composition that feels intuitively right and timeless.",
      promptKeywords:
        "golden ratio landscape, golden proportion, harmonious landscape, fibonacci framing",
      nlDescription:
        "composed using golden proportion divisions across the landscape, creating a timeless and intuitively harmonious arrangement",
      moodTags: "harmonious, timeless, expansive",
      difficulty: "advanced",
      sortOrder: 2,
    },
  ],

  // ── Composition: Symmetry ────────────────────────────────────────────
  symmetry: [
    {
      slug: "perfect-bilateral-symmetry",
      name: "Bilateral Symmetry",
      nameZh: "完全对称",
      description:
        "Mirror-image composition on both sides of the vertical axis, creating formal balance and a sense of order.",
      promptKeywords:
        "perfect symmetry, bilateral symmetry, mirror composition, centered, formal balance",
      nlDescription:
        "perfectly mirrored on both sides of the vertical axis, creating formal balance and a powerful sense of order and symmetry",
      negativeKeywords: "asymmetric, off-center",
      moodTags: "formal, powerful, orderly",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "radial-symmetry",
      name: "Radial Symmetry",
      nameZh: "径向对称",
      description:
        "Elements radiate outward from a central point like a mandala, drawing the eye to the core.",
      promptKeywords:
        "radial symmetry, radial composition, circular symmetry, mandala pattern, radiating from center",
      nlDescription:
        "radiating outward from a central point in a mandala-like pattern, drawing the eye irresistibly toward the luminous core",
      moodTags: "mesmerizing, centered, spiritual",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "near-symmetry",
      name: "Near Symmetry",
      nameZh: "近似对称",
      description:
        "Almost symmetrical but with subtle asymmetry that creates visual tension and keeps the image from feeling static.",
      promptKeywords:
        "near symmetry, almost symmetrical, balanced with slight asymmetry, subtle imbalance",
      nlDescription:
        "almost perfectly symmetrical with just enough subtle asymmetry to create visual tension and keep the composition feeling alive",
      moodTags: "tension, intriguing, dynamic",
      difficulty: "advanced",
      sortOrder: 2,
    },
    {
      slug: "reflection-symmetry",
      name: "Reflection Symmetry",
      nameZh: "倒影对称",
      description:
        "Use water surfaces, mirrors, or glass to create natural symmetrical reflections.",
      promptKeywords:
        "reflection symmetry, mirror reflection, water reflection, symmetrical reflection, reflected image",
      nlDescription:
        "reflected in a mirror-like water surface or glass, creating a perfectly symmetrical mirrored image with doubled visual impact",
      moodTags: "calm, dreamy, elegant",
      difficulty: "beginner",
      sortOrder: 3,
    },
  ],

  // ── Composition: Leading Lines ───────────────────────────────────────
  "leading-lines": [
    {
      slug: "converging-lines",
      name: "Converging Lines",
      nameZh: "汇聚线",
      description:
        "Parallel lines that converge at a vanishing point, creating strong depth and perspective.",
      promptKeywords:
        "leading lines, converging lines, vanishing point, perspective lines, depth lines",
      nlDescription:
        "composed with strong converging lines that draw toward a distant vanishing point, creating powerful depth and perspective",
      moodTags: "dynamic, directional, deep",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "diagonal-leading",
      name: "Diagonal Leading Lines",
      nameZh: "对角引导线",
      description:
        "Diagonal lines that sweep across the frame, adding energy and guiding the eye dynamically.",
      promptKeywords:
        "diagonal lines, diagonal composition, sweeping diagonal, dynamic leading lines",
      nlDescription:
        "framed with bold diagonal lines sweeping across the image, injecting kinetic energy and guiding the eye dynamically through the scene",
      moodTags: "energetic, dynamic, sweeping",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "s-curve-lines",
      name: "S-Curve Composition",
      nameZh: "S形曲线构图",
      description:
        "Sinuous S-shaped curves that create elegant, flowing paths through the image.",
      promptKeywords:
        "S-curve, sinuous curve, flowing line, serpentine path, graceful curve composition",
      nlDescription:
        "arranged around a graceful S-shaped curve winding elegantly through the frame, creating a flowing and serene visual journey",
      moodTags: "elegant, flowing, graceful",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "road-path-perspective",
      name: "Road / Path Perspective",
      nameZh: "道路透视",
      description:
        "A road, path, or bridge receding into the distance creates an irresistible leading line.",
      promptKeywords:
        "road perspective, path into distance, receding road, bridge vanishing point, pathway leading eye",
      nlDescription:
        "featuring a road or path receding into the distance, naturally pulling the viewer's eye along an inviting journey into the scene",
      moodTags: "inviting, directional, journey",
      difficulty: "beginner",
      sortOrder: 3,
    },
  ],

  // ── Composition: Framing ─────────────────────────────────────────────
  framing: [
    {
      slug: "natural-frame",
      name: "Natural Frame",
      nameZh: "自然框架",
      description:
        "Use trees, arches, doorways, or other natural and architectural elements to frame the subject.",
      promptKeywords:
        "framed composition, natural frame, subject framed by arch, doorway framing, window frame",
      nlDescription:
        "framed naturally by architectural elements like doorways and arches or organic features like branches, drawing focused attention inward to the subject",
      moodTags: "focused, intimate, layered",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "archway-frame",
      name: "Archway Frame",
      nameZh: "拱门框架",
      description:
        "Classical or Gothic arches create elegant frames that draw the eye inward to the subject.",
      promptKeywords:
        "archway framing, gothic arch frame, classical arch, arched doorway, framed through arch",
      nlDescription:
        "framed through an elegant classical or gothic archway that draws the eye inward, creating depth and a sense of passage toward the subject",
      moodTags: "classical, dramatic, elegant",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "foliage-frame",
      name: "Foliage Frame",
      nameZh: "树叶框架",
      description:
        "Overhanging branches, leaves, and vegetation create organic, natural frames around the subject.",
      promptKeywords:
        "foliage frame, leaves framing, branches overhead, natural vegetation frame, leaf canopy frame",
      nlDescription:
        "framed by overhanging branches and lush green leaves forming a natural canopy overhead, creating an organic and peaceful vignette around the subject",
      moodTags: "natural, organic, peaceful",
      difficulty: "beginner",
      sortOrder: 2,
    },
    {
      slug: "tunnel-vision-frame",
      name: "Tunnel Vision Frame",
      nameZh: "隧道框架",
      description:
        "A tight circular or tunnel-like frame that focuses all attention on the central subject.",
      promptKeywords:
        "tunnel framing, vignette frame, circular frame, tight framing, spotlight frame",
      nlDescription:
        "tightly framed within a circular or tunnel-like vignette that concentrates all attention squarely on the central subject with intense focus",
      moodTags: "focused, intense, claustrophobic",
      difficulty: "intermediate",
      sortOrder: 3,
    },
  ],

  // ── Composition: Negative Space ──────────────────────────────────────
  "negative-space": [
    {
      slug: "minimalist-negative-space",
      name: "Minimalist Negative Space",
      nameZh: "极简留白",
      description:
        "Vast empty space surrounding a small subject, creating powerful minimalism and emphasis.",
      promptKeywords:
        "minimalist, vast negative space, tiny subject, empty background, lots of white space, sparse",
      nlDescription:
        "isolated within vast empty negative space, the tiny subject commanding attention through powerful minimalism and generous visual breathing room",
      negativeKeywords: "cluttered, busy, detailed background",
      moodTags: "minimalist, peaceful, contemplative",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "sky-dominance",
      name: "Sky Dominance",
      nameZh: "天空留白",
      description:
        "A massive sky occupying 70-80% of the frame with a small ground-level subject below.",
      promptKeywords:
        "dominant sky, large sky, expansive sky, tiny figure below, sky negative space, vast sky",
      nlDescription:
        "dominated by an expansive sky filling most of the frame, with a small figure anchored below emphasizing the overwhelming scale of the heavens",
      moodTags: "expansive, awe-inspiring, free",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "silhouette-negative-space",
      name: "Silhouette with Negative Space",
      nameZh: "剪影留白",
      description:
        "A dark silhouette against a vast, bright negative space for dramatic simplicity.",
      promptKeywords:
        "silhouette, dark figure against bright background, negative space silhouette, simple contrast",
      nlDescription:
        "rendered as a dark silhouette against a vast bright negative space, achieving dramatic simplicity through stark tonal contrast",
      moodTags: "dramatic, stark, powerful",
      difficulty: "intermediate",
      sortOrder: 2,
    },
  ],

  // ── Lighting: Directional ────────────────────────────────────────────
  directional: [
    {
      slug: "side-lighting",
      name: "Side Lighting",
      nameZh: "侧面光",
      description:
        "Light hitting the subject from one side creates strong shadows that reveal texture and form.",
      promptKeywords:
        "side lighting, directional light from side, strong side shadows, half lit, single direction light",
      nlDescription:
        "illuminated from one side with strong directional light that carves out texture and form through deep shadows on the unlit half",
      moodTags: "dramatic, textural, moody",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "top-down-lighting",
      name: "Top-Down Lighting",
      nameZh: "顶部光",
      description:
        "Overhead light creates deep eye-socket shadows and a dramatic, sometimes eerie appearance.",
      promptKeywords:
        "top lighting, overhead light, top-down illumination, deep eye shadows, overhead source",
      nlDescription:
        "lit from directly overhead, casting deep dramatic shadows into the eye sockets and creating an intense, otherworldly atmosphere",
      moodTags: "dramatic, intense, mysterious",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "under-lighting",
      name: "Under Lighting",
      nameZh: "底部光",
      description:
        "Light from below the subject creates unnatural, horror-like shadows perfect for scary or surreal effects.",
      promptKeywords:
        "under lighting, light from below, bottom lit, uplight, horror lighting, ghostly light",
      nlDescription:
        "illuminated from below with an eerie uplight that casts unnatural upward shadows, perfect for horror and surreal effects",
      moodTags: "scary, unnatural, eerie",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "shaft-of-light",
      name: "Shaft of Light",
      nameZh: "光柱",
      description:
        "A single concentrated beam of light cutting through darkness, spotlighting the subject.",
      promptKeywords:
        "shaft of light, light beam, single beam, spotlight beam, god ray, concentrated light",
      nlDescription:
        "pierced by a single concentrated beam of light cutting through the surrounding darkness like a divine spotlight on the subject",
      moodTags: "dramatic, theatrical, focused",
      difficulty: "intermediate",
      sortOrder: 3,
    },
  ],

  // ── Lighting: Ambient ────────────────────────────────────────────────
  ambient: [
    {
      slug: "soft-diffused-lighting",
      name: "Soft Diffused Lighting",
      nameZh: "柔光漫射",
      description:
        "Even, shadowless lighting that wraps gently around the subject. Ideal for beauty and portrait work.",
      promptKeywords:
        "soft diffused lighting, overcast lighting, flat soft light, no harsh shadows, gentle illumination",
      nlDescription:
        "bathed in soft diffused light that wraps gently around the subject with no harsh shadows, creating a flattering and even illumination",
      negativeKeywords: "harsh shadows, hard light, high contrast",
      moodTags: "peaceful, gentle, flattering",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "window-light",
      name: "Window Light",
      nameZh: "窗户光",
      description:
        "Soft directional light from a window that creates gentle gradients and a classic painterly feel.",
      promptKeywords:
        "window light, window lighting, soft directional light, natural indoor light, window illumination",
      nlDescription:
        "illuminated by gentle light streaming through a window, creating soft gradients and a warm classic painterly quality across the scene",
      moodTags: "soft, natural, intimate",
      difficulty: "beginner",
      sortOrder: 1,
    },
    {
      slug: "overcast-daylight",
      name: "Overcast Daylight",
      nameZh: "阴天自然光",
      description:
        "Cloud-diffused daylight that acts as a giant softbox, producing even illumination with minimal shadows.",
      promptKeywords:
        "overcast daylight, cloudy day lighting, soft natural light, even outdoor illumination, diffused sun",
      nlDescription:
        "lit by cloud-diffused overcast daylight acting as a giant natural softbox, producing even illumination with minimal harsh shadows",
      moodTags: "calm, even, melancholic",
      difficulty: "beginner",
      sortOrder: 2,
    },
    {
      slug: "fill-light-ambient",
      name: "Fill Light Ambient",
      nameZh: "环境补光",
      description:
        "Ambient fill that lifts shadows without creating visible direction, maintaining naturalness.",
      promptKeywords:
        "fill light, ambient fill, shadow lift, even illumination, no dark shadows, balanced exposure",
      nlDescription:
        "gently lifted by ambient fill light that softens shadows without creating a visible direction, maintaining a clean and natural look",
      moodTags: "balanced, clean, natural",
      difficulty: "intermediate",
      sortOrder: 3,
    },
  ],

  // ── Lighting: Dramatic ───────────────────────────────────────────────
  dramatic: [
    {
      slug: "rembrandt-lighting",
      name: "Rembrandt Lighting",
      nameZh: "伦勃朗光",
      description:
        "Named after the painter, this technique creates a characteristic triangle of light on the shadowed cheek, producing classic dramatic portraits.",
      promptKeywords:
        "Rembrandt lighting, triangle of light on cheek, dramatic portrait lighting, single source, classic studio",
      nlDescription:
        "illuminated with classic Rembrandt lighting, a characteristic triangle of light appearing on the shadowed cheek for timeless dramatic portraiture",
      moodTags: "dramatic, moody, classic",
      difficulty: "intermediate",
      sortOrder: 0,
    },
    {
      slug: "chiaroscuro",
      name: "Chiaroscuro",
      nameZh: "明暗对比法",
      description:
        "Extreme contrast between light and dark inspired by Caravaggio. The subject emerges from deep shadow into brilliant light.",
      promptKeywords:
        "chiaroscuro, strong contrast between light and dark, Caravaggio style lighting, extreme light-dark contrast",
      nlDescription:
        "dramatically illuminated with extreme chiaroscuro contrast, the subject emerging from deep inky shadow into pools of brilliant Caravaggio-style light",
      negativeKeywords: "flat lighting, even illumination",
      moodTags: "dramatic, dark, mysterious",
      difficulty: "advanced",
      sortOrder: 1,
    },
    {
      slug: "split-lighting",
      name: "Split Lighting",
      nameZh: "分割光",
      description:
        "Half the face is lit, half is in shadow. This creates the most dramatic division of light possible.",
      promptKeywords:
        "split lighting, half face lit, half face shadow, dramatic division, 50/50 lighting",
      nlDescription:
        "lit with dramatic split lighting that divides the face exactly in half, one side bathed in light and the other consumed by shadow",
      moodTags: "dramatic, mysterious, intense",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "rim-lighting",
      name: "Rim Lighting",
      nameZh: "轮廓光",
      description:
        "Backlight that creates a bright outline around the subject's edges, separating them from the background.",
      promptKeywords:
        "rim lighting, backlight, outline glow, edge light, silhouette rim, hair light",
      nlDescription:
        "backlit with a bright glowing rim of light tracing the subject's edges, cleanly separating them from the dark background with a luminous outline",
      moodTags: "dramatic, mysterious, cinematic",
      difficulty: "intermediate",
      sortOrder: 3,
    },
    {
      slug: "low-key-lighting",
      name: "Low Key Lighting",
      nameZh: "低调光",
      description:
        "Predominantly dark image with selective illumination on key elements. Most of the frame is shadow.",
      promptKeywords:
        "low key lighting, predominantly dark, selective illumination, dark moody, mostly shadow",
      nlDescription:
        "rendered in low-key lighting with most of the frame swallowed in deep shadow, only selective elements emerging in pools of moody illumination",
      negativeKeywords: "bright, high key, overexposed",
      moodTags: "dark, moody, dramatic",
      difficulty: "intermediate",
      sortOrder: 4,
    },
  ],

  // ── Lighting: Natural ────────────────────────────────────────────────
  natural: [
    {
      slug: "golden-hour",
      name: "Golden Hour",
      nameZh: "黄金时刻",
      description:
        "The magical hour after sunrise or before sunset when sunlight is warm, soft, and directional with long shadows.",
      promptKeywords:
        "golden hour lighting, warm sunlight, long shadows, sunset glow, warm directional sunlight",
      nlDescription:
        "bathed in warm golden hour sunlight with long directional amber shadows and a rich golden glow that wraps the entire scene in romantic warmth",
      moodTags: "romantic, peaceful, warm",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "blue-hour",
      name: "Blue Hour",
      nameZh: "蓝色时刻",
      description:
        "The twilight period before sunrise or after sunset when the sky takes on deep blue and purple tones.",
      promptKeywords:
        "blue hour, twilight, deep blue sky, pre-dawn light, post-sunset blue, cool twilight",
      nlDescription:
        "immersed in the deep blue and purple tones of the blue hour twilight, creating a calm and melancholic atmosphere with cool serene light",
      moodTags: "calm, melancholic, serene",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "volumetric-lighting",
      name: "Volumetric Lighting",
      nameZh: "体积光",
      description:
        "Visible light rays scattering through fog, dust, or atmosphere, creating visible beams and god rays.",
      promptKeywords:
        "volumetric lighting, god rays, light shafts, crepuscular rays, visible light beams, atmospheric scattering",
      nlDescription:
        "permeated by visible volumetric light rays scattering through fog and dust, creating ethereal god rays and atmospheric beams of light",
      moodTags: "dramatic, ethereal, mystical",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "backlighting",
      name: "Backlighting",
      nameZh: "逆光",
      description:
        "Light source behind the subject creating silhouettes, lens flares, and a bright glowing atmosphere.",
      promptKeywords:
        "backlighting, silhouette, contre-jour, lens flare, bright background, subject backlit",
      nlDescription:
        "backlit with the light source behind the subject, producing glowing silhouettes, warm lens flares, and a radiant ethereal atmosphere",
      moodTags: "dreamy, ethereal, warm",
      difficulty: "intermediate",
      sortOrder: 3,
    },
    {
      slug: "dappled-light",
      name: "Dappled Light",
      nameZh: "斑驳光",
      description:
        "Light filtering through leaves creates a spotted pattern of light and shadow on the ground and subject.",
      promptKeywords:
        "dappled light, light through leaves, spotted shadows, forest light, leaf shadow pattern",
      nlDescription:
        "dappled with scattered light filtering through a leafy canopy above, creating a spotted pattern of warm sun and soft shadow across the scene",
      moodTags: "natural, peaceful, enchanting",
      difficulty: "intermediate",
      sortOrder: 4,
    },
    {
      slug: "moonlight",
      name: "Moonlight",
      nameZh: "月光",
      description:
        "Cool, silvery moonlight casting soft shadows and creating a serene nocturnal atmosphere.",
      promptKeywords:
        "moonlight, moonlit scene, silvery light, night lighting, lunar illumination, cool moonlight",
      nlDescription:
        "illuminated by cool silvery moonlight that casts soft blue-tinted shadows and creates a serene, mysterious nocturnal atmosphere",
      moodTags: "calm, mysterious, serene",
      difficulty: "intermediate",
      sortOrder: 5,
    },
  ],

  // ── Lighting: Studio ─────────────────────────────────────────────────
  studio: [
    {
      slug: "butterfly-lighting",
      name: "Butterfly Lighting",
      nameZh: "蝴蝶光",
      description:
        "Light placed directly above and in front of the subject, creating a butterfly-shaped shadow under the nose. Glamorous and classic.",
      promptKeywords:
        "butterfly lighting, paramount lighting, shadow under nose, glamorous lighting, top-front light",
      nlDescription:
        "lit with glamorous butterfly lighting from directly above and in front, casting a delicate butterfly-shaped shadow beneath the nose for classic beauty",
      moodTags: "elegant, glamorous, classic",
      difficulty: "intermediate",
      sortOrder: 0,
    },
    {
      slug: "loop-lighting",
      name: "Loop Lighting",
      nameZh: "环形光",
      description:
        "A small loop-shaped shadow beside the nose. The most common studio portrait lighting pattern.",
      promptKeywords:
        "loop lighting, small nose shadow loop, portrait studio light, classic portrait pattern",
      nlDescription:
        "illuminated with professional loop lighting, casting a small loop-shaped shadow beside the nose for a flattering and natural studio portrait look",
      moodTags: "flattering, natural, professional",
      difficulty: "beginner",
      sortOrder: 1,
    },
    {
      slug: "beauty-lighting",
      name: "Beauty Lighting",
      nameZh: "美妆光",
      description:
        "Soft, frontal lighting with fill that minimizes shadows and blemishes. Standard for beauty and fashion photography.",
      promptKeywords:
        "beauty lighting, beauty dish, soft frontal light, shadowless beauty, fashion lighting setup",
      nlDescription:
        "lit with soft frontal beauty lighting that smooths skin and minimizes shadows, creating a flawless and glamorous high-fashion look",
      negativeKeywords: "harsh shadows, dramatic",
      moodTags: "glamorous, clean, flattering",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "three-point-lighting",
      name: "Three-Point Lighting",
      nameZh: "三点布光",
      description:
        "The standard key-fill-backlight setup that creates dimensional, professional-looking illumination.",
      promptKeywords:
        "three-point lighting, key light fill light backlight, professional lighting setup, studio three lights",
      nlDescription:
        "illuminated with professional three-point lighting using key, fill, and backlight for dimensional and polished studio-quality illumination",
      moodTags: "professional, dimensional, clean",
      difficulty: "beginner",
      sortOrder: 3,
    },
    {
      slug: "high-key-lighting",
      name: "High Key Lighting",
      nameZh: "高调光",
      description:
        "Bright, even lighting with minimal shadows, producing an upbeat, clean, airy look.",
      promptKeywords:
        "high key lighting, bright even illumination, minimal shadows, airy bright, white background, clean light",
      nlDescription:
        "flooded with bright high-key lighting that eliminates deep shadows, creating an airy, clean, and cheerful atmosphere throughout the frame",
      negativeKeywords: "dark, moody, shadow",
      moodTags: "bright, cheerful, clean",
      difficulty: "beginner",
      sortOrder: 4,
    },
  ],

  // ── Lighting: Neon / Glow ────────────────────────────────────────────
  "neon-glow": [
    {
      slug: "neon-cyberpunk",
      name: "Neon Cyberpunk",
      nameZh: "霓虹赛博朋克",
      description:
        "Vivid neon lights in pink, blue, and purple creating a cyberpunk aesthetic with urban energy.",
      promptKeywords:
        "neon lighting, neon glow, cyberpunk lights, colored neon, pink and blue neon, urban neon signs",
      nlDescription:
        "saturated in vivid pink, blue, and purple neon light from urban signs, casting colorful glows and reflections across the cyberpunk scene",
      moodTags: "energetic, futuristic, bold",
      difficulty: "intermediate",
      sortOrder: 0,
    },
    {
      slug: "rgb-edge-lighting",
      name: "RGB Edge Lighting",
      nameZh: "RGB边缘光",
      description:
        "Colored RGB light strips creating multi-colored edge lighting around the subject or scene.",
      promptKeywords:
        "RGB lighting, RGB edge light, multi-colored edge glow, color-changing LED, gaming light strips",
      nlDescription:
        "outlined with multi-colored RGB edge lighting that traces the subject's contours in shifting hues of vibrant electric color",
      moodTags: "energetic, futuristic, playful",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "bioluminescence",
      name: "Bioluminescence Glow",
      nameZh: "生物发光",
      description:
        "Natural-looking organic glow from plants, creatures, or magical elements in fantasy scenes.",
      promptKeywords:
        "bioluminescence, organic glow, glowing plants, luminous flora, magical glow, bio light",
      nlDescription:
        "glowing with organic bioluminescent light emanating from magical plants and creatures, casting an ethereal emerald and sapphire radiance",
      moodTags: "mysterious, magical, enchanting",
      difficulty: "advanced",
      sortOrder: 2,
    },
    {
      slug: "holographic-glow",
      name: "Holographic Glow",
      nameZh: "全息发光",
      description:
        "Iridescent holographic light with prismatic color shifts and a futuristic sci-fi feel.",
      promptKeywords:
        "holographic, hologram glow, prismatic light, iridescent glow, holographic shimmer, rainbow refraction",
      nlDescription:
        "shimmering with iridescent holographic light that shifts through prismatic rainbow colors, creating a futuristic sci-fi iridescent effect",
      moodTags: "futuristic, magical, iridescent",
      difficulty: "advanced",
      sortOrder: 3,
    },
  ],

  // ── Color: Warm Tones ────────────────────────────────────────────────
  "warm-tones": [
    {
      slug: "warm-sunset-palette",
      name: "Warm Sunset Palette",
      nameZh: "暖色日落调色板",
      description:
        "Dominant oranges, ambers, and golds reminiscent of sunset, creating warmth and nostalgia.",
      promptKeywords:
        "warm colors, orange, amber, golden tones, sunset palette, warm color grading",
      nlDescription:
        "rendered in a warm sunset palette of rich oranges, deep ambers, and golden hues that bathe the scene in nostalgic warmth",
      moodTags: "warm, romantic, nostalgic",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "golden-sepia",
      name: "Golden Sepia",
      nameZh: "金色怀旧",
      description:
        "A warm sepia-toned palette with golden highlights for a vintage, timeless feel.",
      promptKeywords:
        "golden sepia, sepia tone, warm vintage, aged golden, antique gold tone",
      nlDescription:
        "toned in warm golden sepia with antique highlights, evoking a vintage and timeless quality with aged photographic warmth",
      moodTags: "nostalgic, vintage, warm",
      difficulty: "beginner",
      sortOrder: 1,
    },
    {
      slug: "fire-and-amber",
      name: "Fire & Amber",
      nameZh: "火焰与琥珀",
      description:
        "Intense reds, oranges, and deep amber for dramatic, fiery imagery.",
      promptKeywords:
        "fire tones, amber, deep red, orange glow, fiery color palette, molten gold",
      nlDescription:
        "dominated by intense fiery reds and deep amber tones, creating a dramatic and blazing color palette that radiates raw energy",
      moodTags: "dramatic, intense, energetic",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "earthy-warm",
      name: "Earthy Warm Tones",
      nameZh: "大地暖色",
      description:
        "Warm browns, terracotta, and ochre tones inspired by nature and earth.",
      promptKeywords:
        "earthy tones, terracotta, ochre, warm brown, natural earth palette, sienna tones",
      nlDescription:
        "colored in warm earthy tones of terracotta, ochre, and sienna, grounding the scene in natural organic warmth inspired by the land",
      moodTags: "grounding, natural, warm",
      difficulty: "beginner",
      sortOrder: 3,
    },
  ],

  // ── Color: Cool Tones ────────────────────────────────────────────────
  "cool-tones": [
    {
      slug: "cool-blue-teal",
      name: "Cool Blue & Teal",
      nameZh: "冷蓝青色",
      description:
        "Blue and teal dominated palette that feels cold, calm, or melancholic.",
      promptKeywords:
        "cool tones, blue, teal, cold color palette, icy blue, teal grading",
      nlDescription:
        "rendered in a cool palette of blues and teals that washes the scene in a calm, cold, and melancholic atmosphere",
      moodTags: "calm, melancholic, cold",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "frost-ice-palette",
      name: "Frost & Ice",
      nameZh: "冰霜色调",
      description:
        "Pale blues, whites, and silvers that evoke frozen landscapes and winter chill.",
      promptKeywords:
        "frost, ice palette, icy white, pale blue, frozen tones, glacial blue, silver ice",
      nlDescription:
        "bathed in frosty pale blues, icy whites, and silver tones that evoke frozen glacial landscapes and the crisp chill of deep winter",
      moodTags: "cold, crisp, pure",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "deep-ocean-blue",
      name: "Deep Ocean Blue",
      nameZh: "深海蓝",
      description:
        "Deep navy and dark ocean blues suggesting depth, mystery, and the unknown.",
      promptKeywords:
        "deep ocean blue, navy, dark blue, abyssal blue, underwater blue, midnight blue",
      nlDescription:
        "submerged in deep navy and dark ocean blues, suggesting unfathomable depth, mystery, and the vast unknown of the abyss",
      moodTags: "mysterious, deep, vast",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "teal-orange-split",
      name: "Teal & Orange Split Tone",
      nameZh: "青橙分色调色",
      description:
        "Hollywood's favorite color grade: teal shadows with orange highlights for maximum visual pop.",
      promptKeywords:
        "teal and orange, orange and teal, split toning, teal shadows orange highlights, cinematic color grade",
      nlDescription:
        "color-graded with a cinematic teal and orange split tone, teal shadows contrasting against warm orange highlights for maximum visual pop",
      moodTags: "cinematic, dramatic, bold",
      difficulty: "intermediate",
      sortOrder: 3,
    },
  ],

  // ── Color: Monochrome ────────────────────────────────────────────────
  monochrome: [
    {
      slug: "black-and-white",
      name: "Black & White",
      nameZh: "黑白",
      description:
        "Classic black and white removes color distraction, focusing entirely on form, light, and composition.",
      promptKeywords:
        "black and white, monochrome, grayscale, B&W, no color, desaturated to zero",
      nlDescription:
        "rendered in classic black and white monochrome, stripping away color to focus entirely on form, light, shadow, and composition",
      negativeKeywords: "colorful, saturated, vivid",
      moodTags: "artistic, timeless, dramatic",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "sepia-monochrome",
      name: "Sepia Monochrome",
      nameZh: "棕褐色调",
      description:
        "Warm brown monochrome that adds a nostalgic, aged quality to images.",
      promptKeywords:
        "sepia, sepia tone, monochrome brown, warm monochrome, vintage sepia, aged photograph",
      nlDescription:
        "toned in warm brown sepia monochrome that gives the image an aged, nostalgic quality reminiscent of antique photographs",
      negativeKeywords: "colorful, modern",
      moodTags: "nostalgic, vintage, warm",
      difficulty: "beginner",
      sortOrder: 1,
    },
    {
      slug: "desaturated-muted",
      name: "Desaturated Muted",
      nameZh: "低饱和灰调",
      description:
        "Colors are present but heavily desaturated for a muted, understated artistic quality.",
      promptKeywords:
        "desaturated, muted palette, low saturation, muted colors, subdued tones, washed out",
      nlDescription:
        "colored in heavily desaturated muted tones that create an understated, moody, and artistically subdued atmosphere",
      negativeKeywords: "vivid, bright, saturated",
      moodTags: "moody, understated, artistic",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "single-hue-monochrome",
      name: "Single Hue Monochrome",
      nameZh: "单色色调",
      description:
        "Entire image rendered in shades of a single color for a bold, unified aesthetic.",
      promptKeywords:
        "single color, monochrome blue, monochrome red, single hue, tonal monochrome, one color",
      nlDescription:
        "rendered entirely in shades of a single color, creating a bold and unified monochromatic aesthetic with tonal depth",
      moodTags: "artistic, bold, unified",
      difficulty: "intermediate",
      sortOrder: 3,
    },
  ],

  // ── Color: Complementary ─────────────────────────────────────────────
  complementary: [
    {
      slug: "red-green-complementary",
      name: "Red & Green Complementary",
      nameZh: "红绿互补",
      description:
        "Classic Christmas-adjacent complementary pair that creates vibrant visual tension.",
      promptKeywords:
        "red and green, complementary colors, red green contrast, Christmas colors, opposite colors",
      nlDescription:
        "painted with a vibrant red and green complementary color pair that creates festive visual tension and bold chromatic contrast",
      moodTags: "vibrant, festive, contrasting",
      difficulty: "intermediate",
      sortOrder: 0,
    },
    {
      slug: "blue-orange-cinematic",
      name: "Blue & Orange Cinematic",
      nameZh: "蓝橙电影色调",
      description:
        "The most popular complementary pair in cinema, creating visually striking contrast.",
      promptKeywords:
        "blue and orange, cinematic color contrast, warm cool contrast, complementary pairing",
      nlDescription:
        "color-graded with the iconic blue and orange cinematic complementary pair, creating visually striking warm-cool contrast",
      moodTags: "cinematic, bold, dramatic",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "purple-yellow-contrast",
      name: "Purple & Yellow Contrast",
      nameZh: "紫黄对比",
      description:
        "Regal purple paired with bright yellow for a luxurious, eye-catching combination.",
      promptKeywords:
        "purple and yellow, violet gold, complementary purple yellow, regal contrast, majestic colors",
      nlDescription:
        "adorned with regal purple paired against bright yellow, creating a luxurious and eye-catching complementary contrast",
      moodTags: "luxurious, bold, eye-catching",
      difficulty: "advanced",
      sortOrder: 2,
    },
    {
      slug: "cyan-magenta-pop",
      name: "Cyan & Magenta Pop",
      nameZh: "青品红撞色",
      description:
        "Electric cyan and hot magenta for a hyper-modern, pop-art inspired look.",
      promptKeywords:
        "cyan and magenta, CMYK colors, electric cyan, hot magenta, pop art colors, neon complementary",
      nlDescription:
        "electrified with electric cyan and hot magenta complementary colors, creating a hyper-modern pop-art inspired visual punch",
      moodTags: "energetic, modern, bold",
      difficulty: "advanced",
      sortOrder: 3,
    },
  ],

  // ── Color: Pastel ────────────────────────────────────────────────────
  pastel: [
    {
      slug: "pastel-dream",
      name: "Pastel Dream",
      nameZh: "粉彩梦幻",
      description:
        "Soft pink, lavender, mint, and baby blue creating a dreamy, sweet aesthetic.",
      promptKeywords:
        "pastel colors, soft pink, lavender, mint, baby blue, cream, pastel palette",
      nlDescription:
        "washed in soft pastel colors of gentle pink, lavender, mint, and baby blue that create a dreamy and sweetly ethereal aesthetic",
      moodTags: "dreamy, gentle, sweet",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "sakura-pink-pastel",
      name: "Sakura Pink Pastel",
      nameZh: "樱花粉",
      description:
        "Delicate cherry-blossom pink with soft whites and pale greens for a Japanese spring aesthetic.",
      promptKeywords:
        "sakura pink, cherry blossom pink, pastel pink, soft pink palette, spring pastel, Japanese pink",
      nlDescription:
        "tinted in delicate cherry blossom pink with soft whites and pale greens, evoking the gentle beauty of Japanese spring",
      moodTags: "romantic, gentle, spring",
      difficulty: "beginner",
      sortOrder: 1,
    },
    {
      slug: "cotton-candy",
      name: "Cotton Candy",
      nameZh: "棉花糖色调",
      description:
        "Swirled pinks, blues, and purples like cotton candy for a whimsical, playful feel.",
      promptKeywords:
        "cotton candy colors, pink and blue swirl, pastel gradient, whimsical pastel, candy colors",
      nlDescription:
        "swirled with cotton candy pinks, blues, and purples blending together in a whimsical and playful pastel gradient",
      moodTags: "playful, whimsical, sweet",
      difficulty: "beginner",
      sortOrder: 2,
    },
    {
      slug: "lavender-fields",
      name: "Lavender Fields",
      nameZh: "薰衣草色调",
      description:
        "Soft purple lavender tones with complementary pale yellows and greens.",
      promptKeywords:
        "lavender tones, soft purple, pastel lavender, purple fields, light violet palette",
      nlDescription:
        "colored in soft lavender purple tones complemented by pale yellows and greens, creating a calm and elegantly soothing palette",
      moodTags: "calm, elegant, soothing",
      difficulty: "intermediate",
      sortOrder: 3,
    },
  ],

  // ── Color: Saturated ─────────────────────────────────────────────────
  saturated: [
    {
      slug: "high-saturation-vivid",
      name: "High Saturation Vivid",
      nameZh: "高饱和鲜艳",
      description:
        "Maximum color intensity that makes every element pop with bold, eye-catching vibrancy.",
      promptKeywords:
        "high saturation, vivid colors, vibrant, intense colors, bold palette, ultra saturated",
      nlDescription:
        "exploding with high-saturation vivid colors at maximum intensity, making every element boldly pop with eye-catching vibrancy",
      negativeKeywords: "desaturated, muted, pastel",
      moodTags: "energetic, bold, intense",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "neon-saturated",
      name: "Neon Saturated",
      nameZh: "霓虹饱和",
      description:
        "Colors pushed to neon intensity for a hyper-real, electrified visual impact.",
      promptKeywords:
        "neon colors, hyper saturated, electric colors, glowing colors, day-glo, fluorescent",
      nlDescription:
        "saturated to hyper-real neon intensity with electric glowing colors that create an electrified and visually overwhelming impact",
      moodTags: "energetic, futuristic, bold",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "jewel-tones",
      name: "Jewel Tones",
      nameZh: "宝石色调",
      description:
        "Rich, deep saturated colors inspired by gemstones: ruby, emerald, sapphire, amethyst.",
      promptKeywords:
        "jewel tones, ruby red, emerald green, sapphire blue, amethyst purple, rich saturated",
      nlDescription:
        "rich with deep jewel-toned colors of ruby red, emerald green, sapphire blue, and amethyst purple, evoking luxurious opulence",
      moodTags: "luxurious, rich, opulent",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "pop-art-primary",
      name: "Pop Art Primary",
      nameZh: "波普原色",
      description:
        "Bold primary colors (red, yellow, blue) at full saturation in a pop art inspired style.",
      promptKeywords:
        "primary colors, pop art colors, bold red yellow blue, Roy Lichtenstein, comic book colors",
      nlDescription:
        "painted in bold pop-art primary colors of pure red, yellow, and blue at full saturation, inspired by Roy Lichtenstein and comic books",
      moodTags: "bold, playful, graphic",
      difficulty: "intermediate",
      sortOrder: 3,
    },
  ],

  // ── Camera: Eye Level ────────────────────────────────────────────────
  "eye-level": [
    {
      slug: "neutral-eye-level",
      name: "Neutral Eye Level",
      nameZh: "标准平视",
      description:
        "Camera at subject's eye height for a straightforward, relatable, documentary-style perspective.",
      promptKeywords:
        "eye level shot, neutral perspective, straight-on view, head-on angle, neutral camera height",
      nlDescription:
        "shot from a straightforward neutral eye-level perspective, creating an honest and relatable documentary-style view of the scene",
      moodTags: "neutral, honest, relatable",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "eye-level-portrait",
      name: "Eye Level Portrait",
      nameZh: "平视肖像",
      description:
        "Camera level with the subject's eyes for an intimate, engaging portrait connection.",
      promptKeywords:
        "eye level portrait, camera at eye height, direct gaze, eye contact, straight-on portrait",
      nlDescription:
        "captured at the subject's exact eye level for a direct and engaging portrait that establishes intimate eye contact with the viewer",
      moodTags: "intimate, engaging, direct",
      difficulty: "beginner",
      sortOrder: 1,
    },
    {
      slug: "street-eye-level",
      name: "Street Photography Eye Level",
      nameZh: "街拍平视",
      description:
        "Natural eye-level perspective for candid street photography that feels authentic and unposed.",
      promptKeywords:
        "street photography angle, eye level candid, natural perspective, documentary angle",
      nlDescription:
        "photographed at natural street-level eye height for an authentic and candid documentary perspective that feels unposed and genuine",
      moodTags: "authentic, candid, natural",
      difficulty: "beginner",
      sortOrder: 2,
    },
  ],

  // ── Camera: Low Angle ────────────────────────────────────────────────
  "low-angle": [
    {
      slug: "low-angle-hero",
      name: "Low Angle Hero",
      nameZh: "仰视英雄角度",
      description:
        "Camera below the subject looking up, making the subject appear powerful, heroic, and dominant.",
      promptKeywords:
        "low angle shot, looking up, heroic perspective, powerful angle, subject towering above",
      nlDescription:
        "shot from a low angle looking upward at the subject, making them appear powerful, heroic, and towering with commanding presence",
      moodTags: "powerful, dramatic, heroic",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "worms-eye-view",
      name: "Worm's Eye View",
      nameZh: "虫视角",
      description:
        "Extreme low angle from ground level looking straight up, creating vertigo and grandeur.",
      promptKeywords:
        "worm's eye view, ground level looking up, extreme low angle, from below, skyward perspective",
      nlDescription:
        "captured from an extreme worm's eye view at ground level looking straight up, creating vertiginous grandeur and imposing vertical scale",
      moodTags: "grand, vertiginous, imposing",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "low-angle-architecture",
      name: "Low Angle Architecture",
      nameZh: "仰望建筑",
      description:
        "Looking up at tall buildings from below, emphasizing height, vertical lines, and dominance.",
      promptKeywords:
        "low angle architecture, looking up at building, towering structure, vertical perspective, from below",
      nlDescription:
        "photographed looking steeply upward at towering architecture from below, emphasizing vertical lines and the overwhelming height of the structure",
      moodTags: "imposing, grand, architectural",
      difficulty: "beginner",
      sortOrder: 2,
    },
    {
      slug: "low-angle-portrait",
      name: "Low Angle Portrait",
      nameZh: "仰视肖像",
      description:
        "Slightly below eye level for a portrait that conveys confidence and authority.",
      promptKeywords:
        "low angle portrait, looking up at subject, authoritative pose, slight upward angle, confident framing",
      nlDescription:
        "shot from slightly below eye level looking up at the subject, conveying confidence, authority, and a subtly commanding presence",
      moodTags: "confident, powerful, authoritative",
      difficulty: "intermediate",
      sortOrder: 3,
    },
  ],

  // ── Camera: High Angle ───────────────────────────────────────────────
  "high-angle": [
    {
      slug: "high-angle-overview",
      name: "High Angle Overview",
      nameZh: "俯视概览",
      description:
        "Camera above eye level looking down, making the subject appear smaller and creating overview context.",
      promptKeywords:
        "high angle shot, looking down, overhead perspective, above subject, downward angle",
      nlDescription:
        "shot from a high angle looking downward, making the subject appear smaller while providing a broader contextual overview of the scene",
      moodTags: "observational, contextual, vulnerable",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "high-angle-portrait",
      name: "High Angle Portrait",
      nameZh: "俯视肖像",
      description:
        "Camera above the subject looking down, creating vulnerability or a protective, tender mood.",
      promptKeywords:
        "high angle portrait, looking down at subject, camera above, gentle overhead, protective angle",
      nlDescription:
        "photographed from slightly above the subject looking down, creating a tender and intimate mood with a sense of gentle vulnerability",
      moodTags: "tender, vulnerable, intimate",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "high-angle-landscape",
      name: "High Angle Landscape",
      nameZh: "高角度风景",
      description:
        "Elevated perspective over a landscape revealing patterns and scale not visible from ground level.",
      promptKeywords:
        "high angle landscape, elevated view, hilltop perspective, panoramic vantage, looking down on scenery",
      nlDescription:
        "captured from an elevated vantage point looking down over the landscape, revealing sweeping patterns and majestic scale across the terrain",
      moodTags: "expansive, revealing, majestic",
      difficulty: "beginner",
      sortOrder: 2,
    },
  ],

  // ── Camera: Bird's Eye ───────────────────────────────────────────────
  "birds-eye": [
    {
      slug: "birds-eye-view",
      name: "Bird's Eye View",
      nameZh: "鸟瞰",
      description:
        "Directly overhead camera position that flattens perspective and reveals geometric patterns.",
      promptKeywords:
        "bird's eye view, aerial perspective, top-down view, overhead shot, directly above",
      nlDescription:
        "photographed from directly overhead in a bird's eye view that flattens perspective and transforms the scene into a graphic two-dimensional pattern",
      moodTags: "expansive, detached, graphic",
      difficulty: "intermediate",
      sortOrder: 0,
    },
    {
      slug: "drone-aerial",
      name: "Drone Aerial",
      nameZh: "无人机航拍",
      description:
        "High-altitude drone perspective capturing vast landscapes, city grids, and patterns from above.",
      promptKeywords:
        "drone shot, aerial photography, high altitude view, overhead drone, top-down aerial",
      nlDescription:
        "captured from a high-altitude drone perspective, revealing vast sweeping landscapes and the geometric patterns of the world from above",
      moodTags: "expansive, majestic, detached",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "flat-lay",
      name: "Flat Lay",
      nameZh: "平面摆拍",
      description:
        "Objects arranged on a surface shot from directly above, popular in product and food photography.",
      promptKeywords:
        "flat lay, top-down product, overhead flat lay, arranged from above, surface top-down",
      nlDescription:
        "arranged as a flat lay shot from directly above, with objects neatly organized on a surface for a clean and aesthetic product-style composition",
      moodTags: "organized, clean, aesthetic",
      difficulty: "beginner",
      sortOrder: 2,
    },
    {
      slug: "overhead-pattern",
      name: "Overhead Pattern",
      nameZh: "俯视图案",
      description:
        "From directly above, natural and urban patterns become abstract graphic art.",
      promptKeywords:
        "overhead pattern, abstract from above, geometric aerial, top-down pattern, aerial geometry",
      nlDescription:
        "photographed from directly above, transforming natural and urban scenes into abstract graphic patterns with bold geometric shapes",
      moodTags: "abstract, graphic, artistic",
      difficulty: "intermediate",
      sortOrder: 3,
    },
  ],

  // ── Camera: Dutch Angle ──────────────────────────────────────────────
  "dutch-angle": [
    {
      slug: "dutch-angle-dynamic",
      name: "Dutch Angle Dynamic",
      nameZh: "倾斜动态角度",
      description:
        "Tilted camera creates diagonal lines and a sense of unease, energy, or chaos.",
      promptKeywords:
        "dutch angle, tilted frame, diagonal composition, dynamic angle, canted angle, tilted horizon",
      nlDescription:
        "shot with a tilted dutch angle that introduces diagonal lines and a sense of kinetic energy, unease, and visual dynamism to the frame",
      moodTags: "energetic, unsettling, dynamic",
      difficulty: "intermediate",
      sortOrder: 0,
    },
    {
      slug: "dutch-angle-horror",
      name: "Dutch Angle Horror",
      nameZh: "恐怖倾斜角",
      description:
        "Exaggerated tilt that creates psychological unease, commonly used in horror and thriller genres.",
      promptKeywords:
        "dutch angle horror, extreme tilt, unsettling angle, psychological horror framing, unstable composition",
      nlDescription:
        "framed with an exaggerated dutch angle tilt that induces psychological unease and disorientation, classic to horror and thriller cinematography",
      moodTags: "scary, unsettling, tense",
      difficulty: "advanced",
      sortOrder: 1,
    },
    {
      slug: "dutch-angle-action",
      name: "Dutch Angle Action",
      nameZh: "动作倾斜角",
      description:
        "Moderate tilt adding kinetic energy to action sequences and dynamic movement.",
      promptKeywords:
        "dutch angle action, dynamic tilt, kinetic framing, action movie angle, energetic tilt",
      nlDescription:
        "captured with a moderate dutch angle tilt that injects kinetic energy and fast-paced excitement into the action-packed composition",
      moodTags: "energetic, fast, exciting",
      difficulty: "intermediate",
      sortOrder: 2,
    },
  ],

  // ── Camera: Close-up / Macro ─────────────────────────────────────────
  "close-up-macro": [
    {
      slug: "extreme-close-up",
      name: "Extreme Close-up",
      nameZh: "极端特写",
      description:
        "Very tight framing on specific features like eyes, lips, or hands for intense emotional impact.",
      promptKeywords:
        "extreme close-up, macro shot, detailed, ECU, tight crop on face, extreme detail",
      nlDescription:
        "framed in an extreme close-up that crops in tight on specific details, filling the frame with intimate intensity and revealing fine textures",
      moodTags: "intense, intimate, detailed",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "macro-nature",
      name: "Macro Nature",
      nameZh: "微距自然",
      description:
        "Ultra-close photography of natural details: insects, dewdrops, flower stamens, textures.",
      promptKeywords:
        "macro photography, close-up nature, insect macro, dewdrop close-up, flower detail, extreme close nature",
      nlDescription:
        "captured in ultra-close macro photography of nature, revealing the extraordinary hidden details of insects, dewdrops, and flower stamens",
      moodTags: "detailed, delicate, fascinating",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "detail-shot-texture",
      name: "Detail / Texture Shot",
      nameZh: "细节/纹理特写",
      description:
        "Close-up focusing on surface textures: fabric weave, skin pores, wood grain, metal scratches.",
      promptKeywords:
        "texture detail, surface close-up, fabric texture, skin detail, material macro, tactile close-up",
      nlDescription:
        "photographed in a detailed texture close-up that reveals the tactile surface qualities of fabric, skin, wood grain, or metal",
      moodTags: "tactile, detailed, sensory",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "eye-close-up",
      name: "Eye Close-up",
      nameZh: "眼部特写",
      description:
        "Intense close-up on the eye capturing iris detail, reflections, and emotion.",
      promptKeywords:
        "eye close-up, iris detail, macro eye, reflection in eye, detailed iris, emotional eye",
      nlDescription:
        "framed in an intense close-up on the eye that captures every intricate detail of the iris along with tiny reflections hinting at the surrounding world",
      moodTags: "intense, intimate, revealing",
      difficulty: "intermediate",
      sortOrder: 3,
    },
  ],

  // ── Atmosphere: Fog / Mist ───────────────────────────────────────────
  "fog-mist": [
    {
      slug: "dense-fog",
      name: "Dense Fog",
      nameZh: "浓雾",
      description:
        "Thick fog that obscures the background and creates an eerie, mysterious atmosphere.",
      promptKeywords:
        "dense fog, heavy mist, low visibility, atmospheric haze, thick fog, pea soup fog",
      nlDescription:
        "shrouded in thick dense fog that heavily obscures the background, creating an eerie and atmospheric scene with deeply reduced visibility",
      moodTags: "mysterious, eerie, atmospheric",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "morning-mist",
      name: "Morning Mist",
      nameZh: "晨雾",
      description:
        "Soft morning mist hovering over fields and water, creating a serene, peaceful start-of-day mood.",
      promptKeywords:
        "morning mist, early morning fog, mist over water, soft haze, dawn mist, gentle fog",
      nlDescription:
        "veiled in soft gentle morning mist hovering over fields and water, creating a serene and peaceful atmosphere at the start of a new day",
      moodTags: "peaceful, serene, fresh",
      difficulty: "beginner",
      sortOrder: 1,
    },
    {
      slug: "creeping-ground-fog",
      name: "Creeping Ground Fog",
      nameZh: "地面雾气",
      description:
        "Low-lying fog that hugs the ground, creating spooky or mystical scenes.",
      promptKeywords:
        "ground fog, low lying fog, creeping mist, fog on ground, ankle-high fog, dry ice fog",
      nlDescription:
        "draped in low-lying ground fog that hugs the earth, creeping across the surface and creating a spooky or mystical ethereal atmosphere",
      moodTags: "spooky, mystical, ethereal",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "foggy-forest",
      name: "Foggy Forest",
      nameZh: "雾中森林",
      description:
        "Trees fading into mist, creating depth layers and an enchanted forest atmosphere.",
      promptKeywords:
        "foggy forest, misty woods, trees in fog, enchanted forest mist, forest haze, mystical woodland",
      nlDescription:
        "set in a foggy forest where distant trees fade into layered mist, creating an enchanted woodland atmosphere with receding depth and mystery",
      moodTags: "mysterious, enchanted, deep",
      difficulty: "intermediate",
      sortOrder: 3,
    },
  ],

  // ── Atmosphere: Rain ─────────────────────────────────────────────────
  rain: [
    {
      slug: "heavy-rain",
      name: "Heavy Rain",
      nameZh: "大雨",
      description:
        "Torrential downpour with visible rain streaks and water splashing on surfaces.",
      promptKeywords:
        "heavy rain, torrential rain, downpour, rain streaks, water pouring, storm rain",
      nlDescription:
        "drenched in a torrential heavy downpour with visible rain streaks slashing through the air and water splashing violently across surfaces",
      moodTags: "dramatic, intense, melancholic",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "light-drizzle",
      name: "Light Drizzle",
      nameZh: "细雨",
      description:
        "Gentle, fine rain that creates a soft, melancholic, contemplative mood.",
      promptKeywords:
        "light drizzle, fine rain, gentle rain, soft rainfall, misting rain, light rain",
      nlDescription:
        "veiled in a gentle light drizzle of fine rain that creates a soft, melancholic, and contemplative mood with delicate water droplets",
      moodTags: "melancholic, gentle, contemplative",
      difficulty: "beginner",
      sortOrder: 1,
    },
    {
      slug: "rain-reflections",
      name: "Rain Reflections",
      nameZh: "雨中倒影",
      description:
        "Wet surfaces and puddles reflecting city lights and colors after or during rain.",
      promptKeywords:
        "rain reflections, wet surface reflections, puddle reflections, rain-slicked street, neon reflections in water",
      nlDescription:
        "glistening with rain reflections on wet surfaces and puddles, mirroring colorful city lights and neon signs in rippling water",
      moodTags: "moody, colorful, atmospheric",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "rain-silhouette",
      name: "Rain Silhouette",
      nameZh: "雨中剪影",
      description:
        "Dark figures against rain-lit backgrounds, with umbrellas and raincoats creating iconic shapes.",
      promptKeywords:
        "rain silhouette, figure in rain, umbrella silhouette, rain coat, dark figure in rain, backlit rain",
      nlDescription:
        "framed as a dark silhouette against a rain-lit background, with the iconic shape of an umbrella cutting through the curtain of falling rain",
      moodTags: "melancholic, cinematic, lonely",
      difficulty: "intermediate",
      sortOrder: 3,
    },
  ],

  // ── Atmosphere: Sunset / Golden Hour ─────────────────────────────────
  "sunset-golden-hour": [
    {
      slug: "golden-hour-warm",
      name: "Golden Hour Warmth",
      nameZh: "黄金时刻暖光",
      description:
        "The warm, directional light during the golden hour that bathes everything in amber and gold.",
      promptKeywords:
        "golden hour, warm golden light, long shadows, amber sunlight, golden glow, sunset warm light",
      nlDescription:
        "bathed in warm golden hour light with long directional amber shadows and a rich golden glow that envelops the entire scene in warmth",
      moodTags: "warm, romantic, peaceful",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "sunset-silhouette",
      name: "Sunset Silhouette",
      nameZh: "日落剪影",
      description:
        "Subjects silhouetted against a vivid sunset sky with warm oranges and reds.",
      promptKeywords:
        "sunset silhouette, figure against sunset, orange sky, setting sun, silhouette with sunset backdrop",
      nlDescription:
        "silhouetted against a vivid sunset sky ablaze with warm oranges and deep reds, the dark outline of the subject stark against the blazing horizon",
      moodTags: "romantic, dramatic, peaceful",
      difficulty: "beginner",
      sortOrder: 1,
    },
    {
      slug: "sunrise-dawn",
      name: "Sunrise / Dawn",
      nameZh: "日出/黎明",
      description:
        "The first light of dawn with soft pinks, purples, and cool blues transitioning to warm gold.",
      promptKeywords:
        "sunrise, dawn light, first light, morning glow, pink dawn sky, early morning golden, sunrise colors",
      nlDescription:
        "illuminated by the first soft light of dawn, with gentle pinks and cool blues transitioning to warm gold as the new day breaks over the scene",
      moodTags: "hopeful, fresh, serene",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "magic-hour-landscape",
      name: "Magic Hour Landscape",
      nameZh: "魔幻时刻风景",
      description:
        "Landscape photography during the magic hour with perfectly balanced warm light and long shadows.",
      promptKeywords:
        "magic hour landscape, golden hour scenery, warm landscape light, sunset landscape, golden fields",
      nlDescription:
        "captured during the magic hour with perfectly balanced warm golden light washing across the landscape, casting long shadows across golden fields",
      moodTags: "majestic, warm, expansive",
      difficulty: "intermediate",
      sortOrder: 3,
    },
  ],

  // ── Atmosphere: Night / Dark ─────────────────────────────────────────
  "night-dark": [
    {
      slug: "starry-night",
      name: "Starry Night",
      nameZh: "星空",
      description:
        "A clear night sky filled with stars and possibly the milky way, creating awe and wonder.",
      promptKeywords:
        "starry night sky, milky way, night photography, stars, cosmos, astrophotography, starfield",
      nlDescription:
        "set beneath a vast starry night sky filled with countless stars and the glowing band of the milky way, inspiring awe and cosmic wonder",
      moodTags: "peaceful, awe-inspiring, vast",
      difficulty: "advanced",
      sortOrder: 0,
    },
    {
      slug: "city-night",
      name: "City Night",
      nameZh: "城市夜景",
      description:
        "Urban nightscape with street lights, building windows, and neon signs creating pools of light.",
      promptKeywords:
        "city at night, urban night, city lights, night cityscape, illuminated buildings, street lights night",
      nlDescription:
        "set in a vibrant city at night with street lights, illuminated building windows, and neon signs creating pools of warm light against the darkness",
      moodTags: "energetic, urban, vibrant",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "noir-darkness",
      name: "Noir Darkness",
      nameZh: "黑色电影",
      description:
        "Deep shadows, limited light sources, and high contrast inspired by film noir cinematography.",
      promptKeywords:
        "film noir, dark shadows, high contrast night, noir lighting, moody dark, detective noir",
      nlDescription:
        "plunged into deep film noir darkness with limited light sources and extreme high contrast, evoking moody detective-story cinematography",
      moodTags: "dark, mysterious, dramatic",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "candlelight-dark",
      name: "Candlelight in Darkness",
      nameZh: "烛光暗夜",
      description:
        "Warm candlelight flickering in an otherwise dark scene, creating intimate, warm pools of light.",
      promptKeywords:
        "candlelight, candle flame, warm light in darkness, flickering candle, intimate dark, single flame",
      nlDescription:
        "illuminated by warm flickering candlelight in an otherwise dark scene, creating intimate pools of golden light surrounded by velvety shadow",
      moodTags: "intimate, warm, mysterious",
      difficulty: "intermediate",
      sortOrder: 3,
    },
    {
      slug: "aurora-borealis",
      name: "Aurora Borealis",
      nameZh: "北极光",
      description:
        "The northern lights dancing across the night sky with ethereal green and purple curtains of light.",
      promptKeywords:
        "aurora borealis, northern lights, green aurora, aurora sky, polar lights, dancing aurora",
      nlDescription:
        "illuminated by the ethereal dancing curtains of the aurora borealis, green and purple lights rippling across the star-filled northern sky",
      moodTags: "magical, awe-inspiring, ethereal",
      difficulty: "advanced",
      sortOrder: 4,
    },
  ],

  // ── Atmosphere: Dreamy ───────────────────────────────────────────────
  dreamy: [
    {
      slug: "ethereal-glow",
      name: "Ethereal Glow",
      nameZh: "空灵光芒",
      description:
        "Soft, otherworldly glow that makes the entire scene feel like a dream or fantasy.",
      promptKeywords:
        "ethereal glow, dreamy atmosphere, soft glow, otherworldly light, fantasy atmosphere, angelic light",
      nlDescription:
        "suffused with a soft otherworldly ethereal glow that makes the entire scene feel like a luminous dream or transcendent fantasy",
      moodTags: "dreamy, ethereal, magical",
      difficulty: "intermediate",
      sortOrder: 0,
    },
    {
      slug: "lens-flare-dreamy",
      name: "Lens Flare Dream",
      nameZh: "梦幻耀斑",
      description:
        "Intentional lens flares and light leaks creating a warm, nostalgic, dream-like quality.",
      promptKeywords:
        "lens flare, light leak, dreamy light flare, anamorphic flare, warm flare, hazy flare",
      nlDescription:
        "adorned with intentional warm lens flares and light leaks that wash across the frame, creating a nostalgic and dreamy photographic quality",
      moodTags: "dreamy, nostalgic, warm",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "soft-focus-dream",
      name: "Soft Focus Dream",
      nameZh: "柔焦梦幻",
      description:
        "Slightly out-of-focus or soft-focus rendering that creates a dreamy, impressionistic quality.",
      promptKeywords:
        "soft focus, dreamy blur, gentle blur, soft focus portrait, diffusion filter, dreamy soft",
      nlDescription:
        "rendered in gentle soft focus with a dreamy blur that softens all edges, creating an impressionistic and romantically hazy atmosphere",
      negativeKeywords: "sharp, crisp, detailed",
      moodTags: "dreamy, gentle, impressionistic",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "bokeh-dreamscape",
      name: "Bokeh Dreamscape",
      nameZh: "散景梦境",
      description:
        "Rich, creamy bokeh creating abstract light orbs and a dreamlike shallow depth of field.",
      promptKeywords:
        "bokeh, bokeh background, shallow depth of field, creamy bokeh, bokeh balls, dreamy bokeh",
      nlDescription:
        "surrounded by rich creamy bokeh that transforms background lights into soft luminous orbs, creating a dreamlike shallow depth of field",
      moodTags: "dreamy, abstract, romantic",
      difficulty: "intermediate",
      sortOrder: 3,
    },
    {
      slug: "double-exposure-dream",
      name: "Double Exposure Dream",
      nameZh: "双重曝光梦境",
      description:
        "Overlapping images blended together for a surreal, layered, dreamlike effect.",
      promptKeywords:
        "double exposure, multiple exposure, overlaid images, blended exposure, surreal overlay",
      nlDescription:
        "composed as a dreamy double exposure with overlapping images blended together, creating a surreal and layered visual narrative",
      moodTags: "surreal, artistic, dreamy",
      difficulty: "advanced",
      sortOrder: 4,
    },
  ],

  // ── Atmosphere: Urban ────────────────────────────────────────────────
  urban: [
    {
      slug: "cyberpunk-city",
      name: "Cyberpunk City",
      nameZh: "赛博朋克城市",
      description:
        "Futuristic urban landscape with neon lights, rain-slicked streets, and dense high-rise architecture.",
      promptKeywords:
        "cyberpunk city, neon cityscape, futuristic urban, rain-slicked cyberpunk, dense city, mega-city",
      nlDescription:
        "set in a futuristic cyberpunk cityscape drenched in neon light, with rain-slicked streets reflecting towering high-rise mega-structures",
      moodTags: "futuristic, dark, energetic",
      difficulty: "intermediate",
      sortOrder: 0,
    },
    {
      slug: "urban-alley",
      name: "Urban Alley",
      nameZh: "城市巷道",
      description:
        "Narrow urban alleyways with textured walls, scattered light, and gritty urban atmosphere.",
      promptKeywords:
        "urban alley, narrow alley, city backstreet, textured walls, gritty urban, alleyway atmosphere",
      nlDescription:
        "situated in a narrow urban alleyway with textured weathered walls and scattered light filtering through, creating a gritty atmospheric urban scene",
      moodTags: "gritty, mysterious, urban",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "rooftop-cityscape",
      name: "Rooftop Cityscape",
      nameZh: "屋顶城市景观",
      description:
        "City viewed from a rooftop at dusk or night with sprawling buildings and lights below.",
      promptKeywords:
        "rooftop view, cityscape from above, rooftop city, skyline view, urban rooftop panorama",
      nlDescription:
        "viewed from a rooftop vantage point overlooking the sprawling cityscape at dusk, with buildings and lights stretching to the distant horizon",
      moodTags: "expansive, urban, dramatic",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "urban-decay",
      name: "Urban Decay",
      nameZh: "城市废墟",
      description:
        "Abandoned buildings, peeling paint, and overgrown infrastructure creating post-apocalyptic beauty.",
      promptKeywords:
        "urban decay, abandoned building, ruined architecture, peeling paint, overgrown urban, post-apocalyptic city",
      nlDescription:
        "set among urban decay with abandoned buildings, peeling paint, and overgrown infrastructure creating haunting post-apocalyptic beauty",
      moodTags: "desolate, haunting, gritty",
      difficulty: "intermediate",
      sortOrder: 3,
    },
    {
      slug: "tokyo-street",
      name: "Tokyo Street",
      nameZh: "东京街头",
      description:
        "Vibrant Tokyo street scenes with neon signs, narrow streets, and Japanese urban culture.",
      promptKeywords:
        "Tokyo street, Japanese city night, Shibuya crossing, neon Tokyo, Japanese urban, Shinjuku night",
      nlDescription:
        "captured on a vibrant Tokyo street alive with glowing neon signs, narrow lanes, and the pulsing energy of Japanese urban culture at night",
      moodTags: "vibrant, energetic, cultural",
      difficulty: "intermediate",
      sortOrder: 4,
    },
  ],

  // ── Subject / Pose: Portrait ─────────────────────────────────────────
  portrait: [
    {
      slug: "headshot-portrait",
      name: "Headshot Portrait",
      nameZh: "证件照式肖像",
      description:
        "Clean head and shoulders framing for professional, straightforward portrait photography.",
      promptKeywords:
        "headshot, portrait headshot, head and shoulders, clean portrait, professional headshot, studio portrait",
      nlDescription:
        "framed as a clean professional headshot with head and shoulders centered, creating a direct and polished portrait composition",
      moodTags: "professional, clean, direct",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "three-quarter-portrait",
      name: "Three-Quarter Portrait",
      nameZh: "四分之三肖像",
      description:
        "Subject visible from head to waist or hips, showing more context and body language.",
      promptKeywords:
        "three-quarter portrait, waist-up portrait, 3/4 view, upper body portrait, torso and face",
      nlDescription:
        "composed as a three-quarter portrait showing the subject from head to waist, providing more body language and environmental context",
      moodTags: "engaging, natural, contextual",
      difficulty: "beginner",
      sortOrder: 1,
    },
    {
      slug: "candid-portrait",
      name: "Candid Portrait",
      nameZh: "抓拍肖像",
      description:
        "Unposed, natural expression captured in the moment for authentic emotional connection.",
      promptKeywords:
        "candid portrait, unposed, natural expression, caught moment, authentic emotion, relaxed face",
      nlDescription:
        "captured as an unposed candid portrait with a natural spontaneous expression, creating authentic emotional connection and genuine warmth",
      moodTags: "authentic, natural, intimate",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "looking-away-portrait",
      name: "Looking Away",
      nameZh: "侧望肖像",
      description:
        "Subject looking away from the camera, creating mystery and narrative suggestion.",
      promptKeywords:
        "looking away, averted gaze, looking off camera, pensive profile, not looking at camera, distant gaze",
      nlDescription:
        "posed looking away from the camera with an averted gaze, creating a sense of mystery and suggesting an untold narrative beyond the frame",
      moodTags: "mysterious, contemplative, narrative",
      difficulty: "beginner",
      sortOrder: 3,
    },
    {
      slug: "over-the-shoulder",
      name: "Over the Shoulder",
      nameZh: "过肩肖像",
      description:
        "View from behind the shoulder, creating depth and a sense of looking at something together.",
      promptKeywords:
        "over the shoulder, looking past shoulder, back of head, shoulder in foreground, OTS shot",
      nlDescription:
        "framed over the shoulder from behind, creating a layered composition and a sense of shared perspective looking at something together",
      moodTags: "intimate, layered, narrative",
      difficulty: "intermediate",
      sortOrder: 4,
    },
  ],

  // ── Subject / Pose: Action / Dynamic ─────────────────────────────────
  "action-dynamic": [
    {
      slug: "mid-air-jump",
      name: "Mid-Air Jump",
      nameZh: "跳跃瞬间",
      description:
        "Subject captured at the peak of a jump, suspended in air with dynamic energy.",
      promptKeywords:
        "mid-air jump, jumping, suspended in air, leap, airborne, peak of jump, floating",
      nlDescription:
        "captured at the peak of a dynamic mid-air jump, the subject suspended weightlessly in space with explosive energy and joyful motion",
      moodTags: "energetic, joyful, dynamic",
      difficulty: "intermediate",
      sortOrder: 0,
    },
    {
      slug: "running-motion",
      name: "Running Motion",
      nameZh: "奔跑动态",
      description:
        "Subject in full running stride with motion blur suggesting speed and urgency.",
      promptKeywords:
        "running, motion blur, full stride, sprinting, speed, dynamic running pose, in motion",
      nlDescription:
        "captured in full running stride with motion blur trailing behind, conveying urgent speed and raw athletic energy through the frame",
      moodTags: "energetic, urgent, athletic",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "hair-whip",
      name: "Hair Whip / Hair Flip",
      nameZh: "甩发动态",
      description:
        "Hair in mid-motion creating dramatic arcs and dynamic flowing shapes.",
      promptKeywords:
        "hair flip, hair whip, hair in motion, flowing hair, hair arc, dynamic hair movement, wind-blown hair",
      nlDescription:
        "captured with hair whipping through the air in mid-motion, creating dramatic flowing arcs and dynamic sweeping shapes full of energy",
      moodTags: "dynamic, dramatic, energetic",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "dance-pose",
      name: "Dance Pose",
      nameZh: "舞蹈姿势",
      description:
        "Graceful dance pose capturing the beauty of movement frozen in time.",
      promptKeywords:
        "dance pose, ballet pose, contemporary dance, graceful movement, dancer pose, extended limbs",
      nlDescription:
        "frozen in a graceful dance pose with extended limbs and elegant body lines, capturing the beauty of movement in a single timeless moment",
      moodTags: "graceful, elegant, artistic",
      difficulty: "intermediate",
      sortOrder: 3,
    },
    {
      slug: "martial-arts-pose",
      name: "Martial Arts Pose",
      nameZh: "武术姿势",
      description:
        "Dynamic martial arts stance or kick demonstrating power, precision, and control.",
      promptKeywords:
        "martial arts pose, fighting stance, karate kick, dynamic kick, action pose, combat pose",
      nlDescription:
        "frozen in a powerful martial arts stance or dynamic kick, demonstrating explosive precision and disciplined physical control",
      moodTags: "powerful, dynamic, disciplined",
      difficulty: "intermediate",
      sortOrder: 4,
    },
  ],

  // ── Subject / Pose: Sitting ──────────────────────────────────────────
  sitting: [
    {
      slug: "casual-sitting",
      name: "Casual Sitting",
      nameZh: "随意坐姿",
      description:
        "Relaxed, informal sitting pose on a chair, bench, or floor with natural body language.",
      promptKeywords:
        "casual sitting, relaxed seated pose, sitting casually, informal sitting, natural seated position",
      nlDescription:
        "seated in a relaxed casual pose on a chair or bench with natural unfussy body language and a comfortable, easygoing energy",
      moodTags: "relaxed, natural, casual",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "elegant-seated",
      name: "Elegant Seated",
      nameZh: "优雅坐姿",
      description:
        "Formal, composed sitting with straight posture, crossed legs, and refined hand placement.",
      promptKeywords:
        "elegant seated pose, formal sitting, refined posture, legs crossed, composed seated, graceful sitting",
      nlDescription:
        "posed in an elegant seated position with refined straight posture, gracefully crossed legs, and sophisticated hand placement",
      moodTags: "elegant, refined, formal",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "sitting-on-ground",
      name: "Sitting on Ground",
      nameZh: "席地而坐",
      description:
        "Subject sitting on the ground, steps, or grass with a relaxed, grounded energy.",
      promptKeywords:
        "sitting on ground, sitting on floor, cross-legged, seated on steps, ground sitting, lotus position",
      nlDescription:
        "seated casually on the ground or steps in a relaxed grounded position, with a natural and unpretentious down-to-earth energy",
      moodTags: "relaxed, grounded, casual",
      difficulty: "beginner",
      sortOrder: 2,
    },
    {
      slug: "contemplative-seated",
      name: "Contemplative Seated",
      nameZh: "沉思坐姿",
      description:
        "Sitting with chin on hand or gazing thoughtfully, conveying introspection and mood.",
      promptKeywords:
        "contemplative pose, chin on hand, thinking pose, seated thinking, pensive sitting, hand on cheek seated",
      nlDescription:
        "seated in a contemplative pose with chin resting on hand, gazing thoughtfully as if lost in quiet introspection and reflection",
      moodTags: "contemplative, introspective, calm",
      difficulty: "intermediate",
      sortOrder: 3,
    },
  ],

  // ── Subject / Pose: Standing ─────────────────────────────────────────
  standing: [
    {
      slug: "power-stance",
      name: "Power Stance",
      nameZh: "力量站姿",
      description:
        "Wide stance with hands on hips or arms crossed, projecting confidence and authority.",
      promptKeywords:
        "power stance, confident standing, hands on hips, wide stance, authoritative pose, superhero stance",
      nlDescription:
        "standing in a wide confident power stance with hands on hips, projecting authority and dominant superhero-like presence",
      moodTags: "confident, powerful, dominant",
      difficulty: "beginner",
      sortOrder: 0,
    },
    {
      slug: "casual-standing",
      name: "Casual Standing",
      nameZh: "随意站姿",
      description:
        "Relaxed standing with weight on one leg, natural arm position, and easygoing energy.",
      promptKeywords:
        "casual standing, relaxed standing pose, weight on one leg, natural standing, easygoing pose",
      nlDescription:
        "standing casually with weight shifted to one leg and arms relaxed naturally, conveying an approachable and easygoing demeanor",
      moodTags: "relaxed, natural, approachable",
      difficulty: "beginner",
      sortOrder: 1,
    },
    {
      slug: "contrapposto",
      name: "Contrapposto",
      nameZh: "对立式平衡",
      description:
        "Classical pose where weight rests on one leg, creating an S-curve in the body. Timeless and elegant.",
      promptKeywords:
        "contrapposto, S-curve body, weight on one leg, classical pose, relaxed asymmetry, sculptural pose",
      nlDescription:
        "posed in classical contrapposto with weight resting on one leg, creating a graceful S-curve through the body with timeless sculptural elegance",
      moodTags: "elegant, classical, natural",
      difficulty: "intermediate",
      sortOrder: 2,
    },
    {
      slug: "fashion-model-pose",
      name: "Fashion Model Pose",
      nameZh: "时尚模特站姿",
      description:
        "Dramatic, stylized standing pose typical of fashion editorials with angular limbs and attitude.",
      promptKeywords:
        "fashion pose, model stance, editorial pose, angular pose, high fashion standing, Vogue pose",
      nlDescription:
        "struck in a dramatic angular fashion model pose with stylized limbs and fierce editorial attitude worthy of a high-fashion magazine spread",
      moodTags: "dramatic, fashionable, confident",
      difficulty: "advanced",
      sortOrder: 3,
    },
    {
      slug: "silhouette-standing",
      name: "Standing Silhouette",
      nameZh: "站姿剪影",
      description:
        "Full-body standing silhouette against a bright background, emphasizing the outline form.",
      promptKeywords:
        "standing silhouette, full body silhouette, dark figure, outline pose, backlit standing figure",
      nlDescription:
        "rendered as a dark standing silhouette against a bright background, emphasizing the bold outline form with stark dramatic contrast",
      moodTags: "dramatic, mysterious, powerful",
      difficulty: "beginner",
      sortOrder: 4,
    },
  ],

  // ── Subject / Pose: Fantasy ──────────────────────────────────────────
  fantasy: [
    {
      slug: "floating-levitating",
      name: "Floating / Levitating",
      nameZh: "悬浮",
      description:
        "Subject appears to float or levitate in mid-air, defying gravity for a surreal, magical effect.",
      promptKeywords:
        "levitating, floating in air, hovering, anti-gravity, suspended mid-air, levitation pose",
      nlDescription:
        "floating or levitating in mid-air as if defying gravity, creating a surreal and magical anti-gravity effect with ethereal suspension",
      moodTags: "magical, surreal, ethereal",
      difficulty: "advanced",
      sortOrder: 0,
    },
    {
      slug: "magical-casting",
      name: "Magical Casting Pose",
      nameZh: "施法姿势",
      description:
        "Dynamic pose with hands extended as if casting a spell, with energy emanating from fingertips.",
      promptKeywords:
        "casting spell, magic pose, hands casting, spell casting, energy from hands, magical gesture",
      nlDescription:
        "posed dynamically with hands extended as if casting a powerful spell, crackling magical energy emanating from outstretched fingertips",
      moodTags: "magical, powerful, dramatic",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "winged-pose",
      name: "Winged Pose",
      nameZh: "展翅姿势",
      description:
        "Subject with wings spread or folded, creating angelic, demonic, or fantasy character poses.",
      promptKeywords:
        "angel wings, spread wings, winged character, feathered wings, wings outstretched, angelic pose",
      nlDescription:
        "posed with magnificent wings spread wide, creating an angelic or fantasy character with outstretched feathered wings commanding the frame",
      moodTags: "majestic, ethereal, divine",
      difficulty: "advanced",
      sortOrder: 2,
    },
    {
      slug: "fantasy-warrior",
      name: "Fantasy Warrior Pose",
      nameZh: "奇幻战士姿势",
      description:
        "Heroic warrior stance with weapon, armor, and battle-ready energy from a fantasy world.",
      promptKeywords:
        "fantasy warrior, warrior pose, sword raised, battle stance, armored warrior, heroic fighter",
      nlDescription:
        "struck in a heroic fantasy warrior stance wielding a weapon, clad in detailed armor and radiating battle-ready energy from another world",
      moodTags: "heroic, powerful, epic",
      difficulty: "intermediate",
      sortOrder: 3,
    },
    {
      slug: "elven-grace",
      name: "Elven Grace",
      nameZh: "精灵优雅",
      description:
        "Elongated, graceful elven pose with flowing garments and otherworldly elegance.",
      promptKeywords:
        "elven pose, elf grace, pointed ears, flowing robes, ethereal character, elvish elegance",
      nlDescription:
        "posed with elongated elven grace in flowing robes, pointed ears, and an otherworldly elegance that transcends mortal beauty",
      moodTags: "elegant, ethereal, otherworldly",
      difficulty: "advanced",
      sortOrder: 4,
    },
  ],

  // ── Subject / Pose: Couple / Group ───────────────────────────────────
  "couple-group": [
    {
      slug: "romantic-couple",
      name: "Romantic Couple",
      nameZh: "浪漫双人",
      description:
        "Intimate couple pose showing closeness, affection, and emotional connection.",
      promptKeywords:
        "romantic couple, intimate embrace, couple portrait, loving pose, couple close together",
      nlDescription:
        "posed as a romantic couple in an intimate embrace, showing closeness and warm emotional connection between the two figures",
      moodTags: "romantic, intimate, warm",
      difficulty: "intermediate",
      sortOrder: 0,
    },
    {
      slug: "back-to-back",
      name: "Back to Back",
      nameZh: "背靠背",
      description:
        "Two subjects leaning back-to-back, suggesting partnership, trust, or rivalry.",
      promptKeywords:
        "back to back, two people back to back, leaning together, dual stance, partnership pose",
      nlDescription:
        "posed back-to-back with two figures leaning against each other, suggesting a balanced partnership built on trust and mutual strength",
      moodTags: "cool, dynamic, balanced",
      difficulty: "intermediate",
      sortOrder: 1,
    },
    {
      slug: "group-formation",
      name: "Group Formation",
      nameZh: "群像构图",
      description:
        "Organized group arrangement with varied heights and poses for visual interest.",
      promptKeywords:
        "group portrait, group photo, team formation, multiple people, arranged group, varied poses",
      nlDescription:
        "arranged in a dynamic group formation with varied heights and individual poses, creating visual interest through organized variety",
      moodTags: "unified, social, dynamic",
      difficulty: "advanced",
      sortOrder: 2,
    },
    {
      slug: "walking-together",
      name: "Walking Together",
      nameZh: "并肩同行",
      description:
        "Two or more people walking side by side, creating a natural, storytelling composition.",
      promptKeywords:
        "walking together, side by side walking, couple walking, friends walking, strolling together",
      nlDescription:
        "captured walking side by side together, creating a natural and warm storytelling composition of companionship on a shared journey",
      moodTags: "natural, narrative, warm",
      difficulty: "beginner",
      sortOrder: 3,
    },
    {
      slug: "dramatic-duel",
      name: "Dramatic Duel",
      nameZh: "对决姿势",
      description:
        "Two subjects in opposing dynamic poses suggesting conflict, rivalry, or dramatic tension.",
      promptKeywords:
        "dramatic duel, facing off, two fighters, confrontation pose, opposing stances, VS pose",
      nlDescription:
        "posed in a dramatic face-off with two figures in opposing dynamic stances, crackling with tense confrontational energy and visual rivalry",
      moodTags: "dramatic, tense, powerful",
      difficulty: "advanced",
      sortOrder: 4,
    },
  ],
};

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

export async function seedKnowledge(db: DB): Promise<void> {
  console.log("[seed] Seeding art knowledge base...");

  // ── 1. Insert categories ────────────────────────────────────────────
  await db
    .insert(artCategories)
    .values(
      categoriesData.map((c) => ({
        slug: c.slug,
        name: c.name,
        nameZh: c.nameZh,
        description: c.description,
        icon: c.icon,
        sortOrder: c.sortOrder,
      })),
    )
    .onConflictDoNothing();

  // ── 2. Query back categories and build slug→id map ─────────────────
  const insertedCategories = await db.select().from(artCategories);
  const categoryIdMap = new Map<string, number>();
  for (const cat of insertedCategories) {
    categoryIdMap.set(cat.slug, cat.id);
  }

  // ── 3. Insert subcategories ─────────────────────────────────────────
  const subcategoryRows: {
    categoryId: number;
    slug: string;
    name: string;
    nameZh: string | null;
    description: string | null;
    sortOrder: number | null;
  }[] = [];

  for (const [catSlug, subs] of Object.entries(subcategoriesData)) {
    const categoryId = categoryIdMap.get(catSlug);
    if (!categoryId) {
      console.warn(
        `[seed] Category "${catSlug}" not found, skipping subcategories.`,
      );
      continue;
    }
    for (const sub of subs) {
      subcategoryRows.push({
        categoryId,
        slug: sub.slug,
        name: sub.name,
        nameZh: sub.nameZh,
        description: sub.description,
        sortOrder: sub.sortOrder,
      });
    }
  }

  await db
    .insert(artSubcategories)
    .values(subcategoryRows)
    .onConflictDoNothing();

  // ── 4. Query back subcategories and build slug→id map ──────────────
  const insertedSubcategories = await db.select().from(artSubcategories);
  const subcategoryIdMap = new Map<string, number>();
  for (const sub of insertedSubcategories) {
    subcategoryIdMap.set(sub.slug, sub.id);
  }

  // ── 5. Insert techniques ────────────────────────────────────────────
  const techniqueRows: {
    subcategoryId: number;
    slug: string;
    name: string;
    nameZh: string;
    description: string;
    promptKeywords: string;
    nlDescription: string | null;
    weightHint: number | null;
    negativeKeywords: string | null;
    moodTags: string;
    difficulty: string;
    sortOrder: number;
  }[] = [];

  for (const [subSlug, techniques] of Object.entries(techniquesData)) {
    const subcategoryId = subcategoryIdMap.get(subSlug);
    if (!subcategoryId) {
      console.warn(
        `[seed] Subcategory "${subSlug}" not found, skipping techniques.`,
      );
      continue;
    }
    for (const t of techniques) {
      techniqueRows.push({
        subcategoryId,
        slug: t.slug,
        name: t.name,
        nameZh: t.nameZh,
        description: t.description,
        promptKeywords: t.promptKeywords,
        nlDescription: t.nlDescription ?? null,
        weightHint: t.weightHint ?? null,
        negativeKeywords: t.negativeKeywords ?? null,
        moodTags: t.moodTags,
        difficulty: t.difficulty,
        sortOrder: t.sortOrder,
      });
    }
  }

  await db.insert(artTechniques).values(techniqueRows).onConflictDoNothing();

  // ── Summary ─────────────────────────────────────────────────────────
  const finalCategories = await db.select().from(artCategories);
  const finalSubcategories = await db.select().from(artSubcategories);
  const finalTechniques = await db.select().from(artTechniques);

  console.log(
    `[seed] Art knowledge seeded: ${finalCategories.length} categories, ${finalSubcategories.length} subcategories, ${finalTechniques.length} techniques.`,
  );
}
