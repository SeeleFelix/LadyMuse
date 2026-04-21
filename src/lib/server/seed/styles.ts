import type { DB } from '../db';
import { styleFamilies, styles } from '../db/schema';
import { eq } from 'drizzle-orm';

interface FamilySeed {
  slug: string;
  name: string;
  nameZh: string;
  description: string;
  sortOrder: number;
}

interface StyleSeed {
  familySlug: string;
  slug: string;
  name: string;
  nameZh: string;
  description: string;
  positiveTemplate: string;
  nlTemplate: string;
  negativePrompt: string;
  qualityTags: string;
  recommendedParams: string;
  tags: string;
  sortOrder: number;
}

const families: FamilySeed[] = [
  {
    slug: 'anime',
    name: 'Anime/Illustration',
    nameZh: '二次元/插画',
    description: 'Japanese animation and illustration styles, from general anime aesthetics to specific studio looks.',
    sortOrder: 0
  },
  {
    slug: 'photorealistic',
    name: 'Photorealistic',
    nameZh: '写实摄影',
    description: 'Photography-based styles aiming for realistic imagery, covering cinematic, portrait, and editorial looks.',
    sortOrder: 1
  },
  {
    slug: 'oil-painting',
    name: 'Oil Painting',
    nameZh: '油画',
    description: 'Traditional oil painting styles spanning Renaissance classics to Impressionist masterworks.',
    sortOrder: 2
  },
  {
    slug: 'watercolor',
    name: 'Watercolor',
    nameZh: '水彩',
    description: 'Soft, translucent watercolor techniques including illustration, botanical art, and landscape washes.',
    sortOrder: 3
  },
  {
    slug: 'digital-art',
    name: 'Digital Art',
    nameZh: '数字艺术',
    description: 'Modern digital art styles including concept art, pixel art, and vector illustration.',
    sortOrder: 4
  },
  {
    slug: 'cyberpunk',
    name: 'Cyberpunk/Sci-Fi',
    nameZh: '赛博朋克/科幻',
    description: 'Futuristic and dystopian aesthetics with neon lights, holograms, and high-tech imagery.',
    sortOrder: 5
  },
  {
    slug: 'fantasy',
    name: 'Fantasy',
    nameZh: '奇幻',
    description: 'Magical and fantastical worlds, from epic high fantasy to dark gothic atmospheres.',
    sortOrder: 6
  },
  {
    slug: 'chinese-art',
    name: 'Chinese Art',
    nameZh: '国风/水墨',
    description: 'Traditional and modern Chinese art styles including ink wash painting, wuxia, and New Year prints.',
    sortOrder: 7
  }
];

const styleSeeds: StyleSeed[] = [
  // ── Anime/Illustration ──────────────────────────────────────────────
  {
    familySlug: 'anime',
    slug: 'anime-general',
    name: 'Anime General',
    nameZh: '通用二次元',
    description: 'Versatile anime illustration style with cel shading and clean line work.',
    positiveTemplate:
      '{subject}, anime style, illustration, anime art, cel shading, vibrant colors',
    nlTemplate:
      'An anime illustration of {subject}, drawn in a vibrant anime art style with cel shading and crisp linework',
    negativePrompt: 'photorealistic, 3d render, photo, realistic, blurry',
    qualityTags: 'masterpiece, best quality, highly detailed, sharp focus',
    recommendedParams: '{"steps": 28, "cfg": 7, "sampler": "DPM++ 2M Karras"}',
    tags: 'anime, illustration, cel shading, japanese',
    sortOrder: 0
  },
  {
    familySlug: 'anime',
    slug: 'makoto-shinkai',
    name: 'Makoto Shinkai',
    nameZh: '新海诚风格',
    description: 'Vibrant, atmospheric anime style inspired by Makoto Shinkai films with stunning skies and lighting.',
    positiveTemplate:
      '{subject}, Makoto Shinkai style, anime scenery, vibrant sky, detailed clouds, beautiful lighting, lens flare, breathtaking atmosphere',
    nlTemplate:
      'A breathtaking anime illustration of {subject} in the style of Makoto Shinkai, with vividly colored skies, volumetric light rays piercing through detailed clouds, and a dreamy atmospheric quality',
    negativePrompt: 'photorealistic, ugly, low quality, blurry, text, watermark',
    qualityTags: 'masterpiece, best quality, highly detailed, stunning lighting',
    recommendedParams: '{"steps": 30, "cfg": 7, "sampler": "DPM++ 2M Karras"}',
    tags: 'anime, shinkai, scenery, sky, lighting',
    sortOrder: 1
  },
  {
    familySlug: 'anime',
    slug: 'studio-ghibli',
    name: 'Studio Ghibli',
    nameZh: '吉卜力风格',
    description: 'Warm, hand-drawn aesthetic of Studio Ghibli with watercolor backgrounds and whimsical charm.',
    positiveTemplate:
      '{subject}, Studio Ghibli style, Miyazaki, hand-drawn animation, whimsical, watercolor background, warm tones, nostalgic atmosphere',
    nlTemplate:
      'A whimsical hand-drawn illustration of {subject} in the style of Studio Ghibli and Hayao Miyazaki, featuring soft watercolor backgrounds, warm nostalgic tones, and enchanting storybook charm',
    negativePrompt: 'photorealistic, 3d render, dark, gritty, modern, text',
    qualityTags: 'masterpiece, best quality, highly detailed, hand-drawn',
    recommendedParams: '{"steps": 28, "cfg": 7, "sampler": "Euler a"}',
    tags: 'anime, ghibli, miyazaki, hand-drawn, whimsical',
    sortOrder: 2
  },
  {
    familySlug: 'anime',
    slug: 'anime-realistic',
    name: 'Anime Realistic Mix',
    nameZh: '半写实二次元',
    description: 'A blend of anime aesthetics with realistic rendering, semi-photorealistic skin and lighting.',
    positiveTemplate:
      '{subject}, semi-realistic anime, detailed skin texture, realistic lighting, anime eyes, beautiful detailed face, cinematic composition',
    nlTemplate:
      'A semi-realistic anime illustration of {subject}, blending anime aesthetics with realistic skin textures and lighting, featuring beautifully detailed anime eyes and cinematic composition',
    negativePrompt: 'photo, realistic, 3d, ugly, low quality, deformed',
    qualityTags: 'masterpiece, best quality, ultra detailed, realistic shading',
    recommendedParams: '{"steps": 30, "cfg": 7.5, "sampler": "DPM++ 2M Karras"}',
    tags: 'anime, semi-realistic, detailed, cinematic',
    sortOrder: 3
  },

  // ── Photorealistic ──────────────────────────────────────────────────
  {
    familySlug: 'photorealistic',
    slug: 'cinematic-photography',
    name: 'Cinematic Photography',
    nameZh: '电影感摄影',
    description: 'Cinematic still photography with film grain, anamorphic lens effects, and dramatic composition.',
    positiveTemplate:
      '{subject}, cinematic photography, film grain, anamorphic lens, movie still, 35mm, dramatic lighting, cinematic color grading',
    nlTemplate:
      'A cinematic photograph of {subject}, shot on 35mm film with an anamorphic lens, featuring natural film grain, dramatic lighting, and professional color grading reminiscent of a movie still',
    negativePrompt: 'cartoon, anime, illustration, painting, drawing, blurry, low quality',
    qualityTags: 'photorealistic, ultra detailed, 8k uhd, RAW photo, high resolution',
    recommendedParams: '{"steps": 30, "cfg": 7, "sampler": "DPM++ 2M Karras"}',
    tags: 'photography, cinematic, film, movie still, 35mm',
    sortOrder: 0
  },
  {
    familySlug: 'photorealistic',
    slug: 'portrait-photography',
    name: 'Portrait Photography',
    nameZh: '人像摄影',
    description: 'Professional portrait photography with bokeh, studio lighting, and shallow depth of field.',
    positiveTemplate:
      '{subject}, portrait photography, bokeh, professional lighting, shallow depth of field, 85mm lens, studio lighting, skin detail',
    nlTemplate:
      'A professional portrait photograph of {subject}, shot with an 85mm lens at wide aperture, featuring creamy bokeh background, studio-quality lighting, and exquisite skin detail with shallow depth of field',
    negativePrompt: 'cartoon, anime, painting, illustration, drawing, deformed, ugly, low quality',
    qualityTags: 'photorealistic, ultra detailed, 8k uhd, RAW photo, sharp focus',
    recommendedParams: '{"steps": 30, "cfg": 7, "sampler": "DPM++ 2M Karras"}',
    tags: 'photography, portrait, bokeh, studio, 85mm',
    sortOrder: 1
  },
  {
    familySlug: 'photorealistic',
    slug: 'fashion-photography',
    name: 'Fashion Photography',
    nameZh: '时尚摄影',
    description: 'High-end fashion editorial style with dramatic lighting and striking composition.',
    positiveTemplate:
      '{subject}, fashion photography, editorial, vogue, dramatic lighting, high fashion, studio, professional makeup',
    nlTemplate:
      'A high-end fashion editorial photograph of {subject}, styled like a Vogue magazine spread with dramatic studio lighting, professional makeup, and striking editorial composition',
    negativePrompt: 'casual, amateur, low quality, blurry, painting, anime, cartoon',
    qualityTags: 'photorealistic, ultra detailed, 8k uhd, RAW photo, magazine quality',
    recommendedParams: '{"steps": 30, "cfg": 7.5, "sampler": "DPM++ 2M Karras"}',
    tags: 'photography, fashion, editorial, vogue, studio',
    sortOrder: 2
  },

  // ── Oil Painting ────────────────────────────────────────────────────
  {
    familySlug: 'oil-painting',
    slug: 'renaissance',
    name: 'Renaissance Oil Painting',
    nameZh: '文艺复兴油画',
    description: 'Classical Renaissance oil painting with rich colors, detailed brushwork, and timeless composition.',
    positiveTemplate:
      '{subject}, oil painting, Renaissance style, classical art, rich colors, detailed brushwork, chiaroscuro, masterwork',
    nlTemplate:
      'A classical Renaissance oil painting of {subject}, rendered with rich saturated colors, masterful chiaroscuro lighting, and meticulous brushwork in the timeless tradition of the old masters',
    negativePrompt: 'photo, photograph, modern, anime, cartoon, digital art, blurry',
    qualityTags: 'masterpiece, best quality, highly detailed, classical art, museum quality',
    recommendedParams: '{"steps": 30, "cfg": 7, "sampler": "DPM++ 2M Karras"}',
    tags: 'oil painting, renaissance, classical, chiaroscuro, traditional',
    sortOrder: 0
  },
  {
    familySlug: 'oil-painting',
    slug: 'impressionist',
    name: 'Impressionist',
    nameZh: '印象派',
    description: 'Impressionist painting with visible brushstrokes, emphasis on light and color, inspired by Monet and Renoir.',
    positiveTemplate:
      '{subject}, impressionist painting, visible brushstrokes, light and color, Monet style, en plein air, vibrant palette, atmospheric',
    nlTemplate:
      'An impressionist oil painting of {subject}, with visible expressive brushstrokes capturing fleeting light and color, painted en plein air in the luminous style of Claude Monet with a vibrant atmospheric palette',
    negativePrompt: 'photo, realistic, modern, digital art, anime, sharp lines, smooth',
    qualityTags: 'masterpiece, best quality, artistic, beautiful colors, painterly',
    recommendedParams: '{"steps": 28, "cfg": 7, "sampler": "Euler a"}',
    tags: 'oil painting, impressionist, monet, brushstrokes, light',
    sortOrder: 1
  },

  // ── Watercolor ──────────────────────────────────────────────────────
  {
    familySlug: 'watercolor',
    slug: 'watercolor-illustration',
    name: 'Watercolor Illustration',
    nameZh: '水彩插画',
    description: 'Soft, flowing watercolor illustration with wet-on-wet technique and delicate paper texture.',
    positiveTemplate:
      '{subject}, watercolor painting, watercolor illustration, soft wash, wet on wet technique, paper texture, translucent colors, flowing',
    nlTemplate:
      'A soft flowing watercolor illustration of {subject}, painted using wet-on-wet technique on textured paper with translucent color washes that blend and bleed into each other with delicate organic edges',
    negativePrompt: 'photo, realistic, digital, oil painting, acrylic, sharp lines',
    qualityTags: 'masterpiece, best quality, highly detailed, delicate, soft',
    recommendedParams: '{"steps": 28, "cfg": 7, "sampler": "Euler a"}',
    tags: 'watercolor, illustration, soft, wash, paper texture',
    sortOrder: 0
  },
  {
    familySlug: 'watercolor',
    slug: 'botanical-watercolor',
    name: 'Botanical Watercolor',
    nameZh: '植物水彩',
    description: 'Detailed botanical watercolor illustration with scientific accuracy and delicate color layering.',
    positiveTemplate:
      '{subject}, botanical watercolor illustration, scientific illustration, detailed foliage, delicate washes, layered colors, vintage botanical',
    nlTemplate:
      'A detailed botanical watercolor illustration of {subject}, rendered with scientific precision and delicate layered color washes on cream-colored paper in the tradition of vintage botanical art',
    negativePrompt: 'photo, realistic, digital art, modern, anime, cartoon',
    qualityTags: 'masterpiece, best quality, highly detailed, scientific accuracy',
    recommendedParams: '{"steps": 28, "cfg": 7, "sampler": "DPM++ 2M Karras"}',
    tags: 'watercolor, botanical, scientific, vintage, nature',
    sortOrder: 1
  },

  // ── Digital Art ─────────────────────────────────────────────────────
  {
    familySlug: 'digital-art',
    slug: 'concept-art',
    name: 'Concept Art',
    nameZh: '概念艺术',
    description: 'Professional concept art style commonly seen in game and film production, detailed and atmospheric.',
    positiveTemplate:
      '{subject}, concept art, digital painting, artstation, detailed, fantasy art, matte painting, environment design',
    nlTemplate:
      'A professional concept art digital painting of {subject}, rendered with the level of detail and atmospheric depth found in top-tier Artstation portfolios and AAA game production concept designs',
    negativePrompt: 'photo, amateur, low quality, blurry, ugly, deformed',
    qualityTags: 'masterpiece, best quality, highly detailed, professional, artstation',
    recommendedParams: '{"steps": 30, "cfg": 7, "sampler": "DPM++ 2M Karras"}',
    tags: 'concept art, digital painting, artstation, game art, film',
    sortOrder: 0
  },
  {
    familySlug: 'digital-art',
    slug: 'pixel-art',
    name: 'Pixel Art',
    nameZh: '像素艺术',
    description: 'Retro pixel art style with limited color palette and nostalgic 8-bit/16-bit aesthetics.',
    positiveTemplate:
      '{subject}, pixel art, 16-bit, retro game, sprite art, limited palette, retro, nostalgic, clean pixels',
    nlTemplate:
      'A retro pixel art sprite of {subject}, rendered in a nostalgic 16-bit aesthetic with a carefully limited color palette, clean individual pixels, and the charming simplicity of classic video game art',
    negativePrompt: 'photo, realistic, blurry, smooth, 3d render, high resolution texture',
    qualityTags: 'masterpiece, best quality, clean pixels, detailed pixel art',
    recommendedParams: '{"steps": 20, "cfg": 7, "sampler": "Euler a"}',
    tags: 'pixel art, retro, 8-bit, 16-bit, sprite, game',
    sortOrder: 1
  },

  // ── Cyberpunk/Sci-Fi ────────────────────────────────────────────────
  {
    familySlug: 'cyberpunk',
    slug: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    nameZh: '赛博朋克霓虹',
    description: 'Classic cyberpunk with neon-lit streets, rain-slicked cityscapes, and high-tech low-life atmosphere.',
    positiveTemplate:
      '{subject}, cyberpunk style, neon lights, futuristic city, rain, holographic, high tech low life, blade runner, neon reflections',
    nlTemplate:
      'A cyberpunk scene of {subject}, drenched in neon pink and blue light from holographic signs, rain-slicked streets reflecting electric colors, evoking the high-tech low-life atmosphere of Blade Runner',
    negativePrompt: 'medieval, fantasy, nature, bright, sunny, clean, traditional',
    qualityTags: 'masterpiece, best quality, highly detailed, cinematic lighting, neon glow',
    recommendedParams: '{"steps": 30, "cfg": 7.5, "sampler": "DPM++ SDE Karras"}',
    tags: 'cyberpunk, neon, futuristic, rain, sci-fi, blade runner',
    sortOrder: 0
  },
  {
    familySlug: 'cyberpunk',
    slug: 'sci-fi-space',
    name: 'Sci-Fi Space',
    nameZh: '太空科幻',
    description: 'Epic space opera aesthetic with vast starfields, spacecraft, and futuristic technology.',
    positiveTemplate:
      '{subject}, science fiction, space opera, starfield, spacecraft, futuristic technology, nebula, cosmic, epic scale',
    nlTemplate:
      'An epic science fiction scene of {subject}, set against the vast backdrop of a star-filled cosmos with distant nebulae, sleek spacecraft, and futuristic technology on a breathtaking cosmic scale',
    negativePrompt: 'medieval, fantasy, nature, primitive, low tech, cartoon, anime',
    qualityTags: 'masterpiece, best quality, highly detailed, epic, cinematic, 8k',
    recommendedParams: '{"steps": 30, "cfg": 7, "sampler": "DPM++ 2M Karras"}',
    tags: 'sci-fi, space, spaceship, futuristic, cosmic, epic',
    sortOrder: 1
  },

  // ── Fantasy ─────────────────────────────────────────────────────────
  {
    familySlug: 'fantasy',
    slug: 'epic-fantasy',
    name: 'Epic Fantasy',
    nameZh: '史诗奇幻',
    description: 'Grand high fantasy style with sweeping landscapes, heroic characters, and magical grandeur.',
    positiveTemplate:
      '{subject}, epic fantasy art, high fantasy, magical, heroic, sweeping landscape, grand scale, fantasy illustration, detailed armor',
    nlTemplate:
      'An epic high fantasy illustration of {subject}, rendered with sweeping grandeur, heroic characters in detailed armor, and magical elements set against vast majestic landscapes on a legendary scale',
    negativePrompt: 'modern, sci-fi, cyberpunk, realistic photo, mundane, boring',
    qualityTags: 'masterpiece, best quality, highly detailed, epic, grand, magical',
    recommendedParams: '{"steps": 30, "cfg": 7, "sampler": "DPM++ 2M Karras"}',
    tags: 'fantasy, epic, high fantasy, magical, heroic, landscape',
    sortOrder: 0
  },
  {
    familySlug: 'fantasy',
    slug: 'dark-gothic',
    name: 'Dark Gothic',
    nameZh: '暗黑哥特',
    description: 'Dark, moody gothic atmosphere with shadows, ancient architecture, and an ominous feel.',
    positiveTemplate:
      '{subject}, dark gothic art, moody, shadows, ancient architecture, ominous atmosphere, dark fantasy, dramatic chiaroscuro',
    nlTemplate:
      'A dark gothic illustration of {subject}, shrouded in ominous shadows and dramatic chiaroscuro, with ancient crumbling architecture looming in the gloom and an atmosphere of brooding dark fantasy',
    negativePrompt: 'bright, cheerful, cute, colorful, anime, modern, cartoon',
    qualityTags: 'masterpiece, best quality, highly detailed, atmospheric, dark, moody',
    recommendedParams: '{"steps": 30, "cfg": 7.5, "sampler": "DPM++ SDE Karras"}',
    tags: 'gothic, dark, moody, shadows, atmospheric, dark fantasy',
    sortOrder: 1
  },

  // ── Chinese Art ─────────────────────────────────────────────────────
  {
    familySlug: 'chinese-art',
    slug: 'chinese-ink-wash',
    name: 'Chinese Ink Wash',
    nameZh: '水墨画',
    description: 'Traditional Chinese ink wash painting with minimalist composition, xuan paper texture, and sumi-e brushwork.',
    positiveTemplate:
      '{subject}, Chinese ink wash painting, sumi-e, traditional Chinese painting, ink and wash, xuan paper, minimalist, elegant brushwork',
    nlTemplate:
      'A traditional Chinese ink wash painting of {subject}, rendered in sumi-e style with flowing calligraphic brushstrokes on textured xuan paper, employing minimalist composition with elegant negative space',
    negativePrompt: 'photo, realistic, colorful, modern, digital, oil painting, western',
    qualityTags: 'masterpiece, best quality, elegant, refined, traditional',
    recommendedParams: '{"steps": 25, "cfg": 6.5, "sampler": "Euler a"}',
    tags: 'chinese, ink wash, sumi-e, traditional, minimalist, xuan paper',
    sortOrder: 0
  },
  {
    familySlug: 'chinese-art',
    slug: 'wuxia',
    name: 'Wuxia',
    nameZh: '武侠风格',
    description: 'Wuxia martial arts aesthetic with flowing robes, ink painting influences, and ethereal atmosphere.',
    positiveTemplate:
      '{subject}, wuxia style, Chinese martial arts, flowing robes, ink painting style, ethereal, bamboo forest, sword, traditional Chinese',
    nlTemplate:
      'A wuxia-style illustration of {subject}, depicting a Chinese martial arts hero with flowing robes and a gleaming sword, rendered with ink painting influences and an ethereal bamboo forest atmosphere',
    negativePrompt: 'photo, realistic, modern, western, sci-fi, cyberpunk, cartoon',
    qualityTags: 'masterpiece, best quality, highly detailed, ethereal, elegant',
    recommendedParams: '{"steps": 28, "cfg": 7, "sampler": "DPM++ 2M Karras"}',
    tags: 'chinese, wuxia, martial arts, flowing, ethereal, sword, bamboo',
    sortOrder: 1
  },
  {
    familySlug: 'chinese-art',
    slug: 'new-year-print',
    name: 'Chinese New Year Print',
    nameZh: '年画',
    description: 'Traditional Chinese New Year woodblock print style with bold colors, auspicious symbols, and festive motifs.',
    positiveTemplate:
      '{subject}, Chinese New Year print, woodblock print style, traditional folk art, bold colors, auspicious, festive, red and gold',
    nlTemplate:
      'A traditional Chinese New Year woodblock print of {subject}, rendered in bold festive colors of red and gold with auspicious symbols, in the style of classic folk art nianhua',
    negativePrompt: 'photo, realistic, modern, western, dark, moody, anime, digital art',
    qualityTags: 'masterpiece, best quality, vibrant colors, traditional, festive',
    recommendedParams: '{"steps": 25, "cfg": 7, "sampler": "Euler a"}',
    tags: 'chinese, new year, woodblock, folk art, festive, traditional',
    sortOrder: 2
  }
];

export async function seedStyles(db: DB): Promise<void> {
  console.log('Seeding style families...');

  // Insert style families
  for (const family of families) {
    await db
      .insert(styleFamilies)
      .values(family)
      .onConflictDoNothing()
      .execute();
  }

  // Query back family IDs by slug
  const familyRows = await db
    .select({ id: styleFamilies.id, slug: styleFamilies.slug })
    .from(styleFamilies)
    .execute();

  const familyIdMap = new Map<string, number>();
  for (const row of familyRows) {
    familyIdMap.set(row.slug, row.id);
  }

  console.log('Seeding styles...');

  // Insert styles with resolved family IDs
  for (const style of styleSeeds) {
    const familyId = familyIdMap.get(style.familySlug);
    if (!familyId) {
      console.warn(`Skipping style "${style.slug}": family "${style.familySlug}" not found`);
      continue;
    }

    await db
      .insert(styles)
      .values({
        familyId,
        slug: style.slug,
        name: style.name,
        nameZh: style.nameZh,
        description: style.description,
        positiveTemplate: style.positiveTemplate,
        nlTemplate: style.nlTemplate,
        negativePrompt: style.negativePrompt,
        qualityTags: style.qualityTags,
        recommendedParams: style.recommendedParams,
        tags: style.tags,
        sortOrder: style.sortOrder
      })
      .onConflictDoNothing()
      .execute();
  }

  console.log(`Seeded ${families.length} style families and ${styleSeeds.length} styles.`);
}
