import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { artTechniques, styles, styleFamilies } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function buildTagPrompt(
  subject: string,
  style: typeof styles.$inferSelect | null,
  techs: (typeof artTechniques.$inferSelect)[],
): { positive: string; negative: string } {
  const parts: string[] = [];
  if (subject) parts.push(subject);
  if (style) {
    const tpl = style.positiveTemplate
      .replace("{subject}", "")
      .replace(/,\s*,/, ",")
      .replace(/^,\s*/, "");
    if (tpl.trim()) parts.push(tpl.trim());
  }
  for (const t of techs) {
    parts.push(t.promptKeywords);
  }
  if (style?.qualityTags) parts.push(style.qualityTags);

  const negParts: string[] = [];
  if (style?.negativePrompt) negParts.push(style.negativePrompt);
  for (const t of techs) {
    if (t.negativeKeywords) negParts.push(t.negativeKeywords);
  }
  const negUnique = [
    ...new Set(
      negParts
        .join(", ")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];

  return {
    positive: parts.join(", "),
    negative: negUnique.join(", "),
  };
}

function buildNLPrompt(
  subject: string,
  style: typeof styles.$inferSelect | null,
  techs: (typeof artTechniques.$inferSelect)[],
): { positive: string; negative: string } {
  const subjectText = subject || "a scene";

  let nlParts: string[] = [];
  if (style?.nlTemplate) {
    nlParts.push(style.nlTemplate.replace("{subject}", subjectText));
  } else if (style) {
    nlParts.push(
      `An image of ${subjectText} in ${style.nameZh || style.name} style`,
    );
  } else {
    nlParts.push(`An image of ${subjectText}`);
  }

  for (const t of techs) {
    if (t.nlDescription) {
      nlParts.push(t.nlDescription);
    }
  }

  if (style?.qualityTags) {
    nlParts.push(style.qualityTags);
  }

  const negParts: string[] = [];
  if (style?.negativePrompt) negParts.push(style.negativePrompt);
  for (const t of techs) {
    if (t.negativeKeywords) negParts.push(t.negativeKeywords);
  }
  const negUnique = [
    ...new Set(
      negParts
        .join(", ")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];

  return {
    positive: nlParts.join(", "),
    negative: negUnique.join(", "),
  };
}

const subjects = [
  "a young woman with flowing hair",
  "a lone warrior in ornate armor",
  "an ancient temple in the mountains",
  "a cat sitting on a windowsill",
  "a cyberpunk street food vendor",
  "a dancer in mid-performance",
  "a spaceship orbiting a gas giant",
  "a child playing in autumn leaves",
  "a wise old man reading by candlelight",
  "a mystical forest clearing",
  "a portrait of a noble queen",
  "a samurai standing in the rain",
  "a steampunk airship above the clouds",
  "a woman in a red dress on a rooftop",
  "a dragon perched on a cliff edge",
  "a cozy cafe on a rainy evening",
  "a knight kneeling before a shrine",
  "a girl holding a lantern in the dark",
  "a bustling market in an old city",
  "a wizard casting a spell",
];

export const GET: RequestHandler = async ({ url }) => {
  const mode = url.searchParams.get("mode") || "random"; // random, mood, mix
  const promptMode = url.searchParams.get("prompt_mode") || "tag"; // tag, nl
  const mood = url.searchParams.get("mood");

  const allTechs = await db.select().from(artTechniques);
  const allStyles = await db.select().from(styles);
  const allFamilies = await db.select().from(styleFamilies);

  let selectedTechs: (typeof artTechniques.$inferSelect)[] = [];
  let selectedStyle: typeof styles.$inferSelect | null = null;
  let subject = "";

  if (mode === "mood" && mood) {
    const matching = allTechs.filter((t) =>
      t.moodTags?.toLowerCase().includes(mood.toLowerCase()),
    );
    selectedTechs = pickRandom(matching, Math.min(4, matching.length));
    const styleWithMood = allStyles.filter((s) =>
      s.tags?.toLowerCase().includes(mood.toLowerCase()),
    );
    if (styleWithMood.length > 0) {
      selectedStyle = pickRandom(styleWithMood, 1)[0];
    } else {
      selectedStyle = pickRandom(allStyles, 1)[0];
    }
    subject = pickRandom(subjects, 1)[0];
  } else if (mode === "mix") {
    const twoStyles = pickRandom(allStyles, 2);
    selectedStyle = twoStyles[0];
    const otherStyle = twoStyles[1];
    selectedTechs = pickRandom(allTechs, 3);
    subject = pickRandom(subjects, 1)[0];

    // Include keywords from second style
    const mixInfo = `Mixed style: ${selectedStyle.nameZh || selectedStyle.name} + ${otherStyle.nameZh || otherStyle.name}`;
    const result =
      promptMode === "nl"
        ? buildNLPrompt(subject, selectedStyle, selectedTechs)
        : buildTagPrompt(subject, selectedStyle, selectedTechs);

    if (promptMode === "tag" && otherStyle.positiveTemplate) {
      result.positive +=
        ", " +
        otherStyle.positiveTemplate
          .replace("{subject}", "")
          .replace(/^,\s*/, "");
    } else if (promptMode === "nl" && otherStyle.nlTemplate) {
      result.positive += ", " + otherStyle.nlTemplate.replace("{subject}", "");
    }

    return json({
      subject,
      style: {
        name: selectedStyle.nameZh || selectedStyle.name,
        mixWith: otherStyle.nameZh || otherStyle.name,
      },
      techniques: selectedTechs.map((t) => ({
        name: t.nameZh || t.name,
        slug: t.slug,
      })),
      prompt: result,
      mixInfo,
    });
  } else {
    // random
    selectedTechs = pickRandom(allTechs, 3);
    selectedStyle = pickRandom(allStyles, 1)[0];
    subject = pickRandom(subjects, 1)[0];
  }

  const result =
    promptMode === "nl"
      ? buildNLPrompt(subject, selectedStyle, selectedTechs)
      : buildTagPrompt(subject, selectedStyle, selectedTechs);

  return json({
    subject,
    style: selectedStyle
      ? { name: selectedStyle.nameZh || selectedStyle.name }
      : null,
    techniques: selectedTechs.map((t) => ({
      name: t.nameZh || t.name,
      slug: t.slug,
    })),
    prompt: result,
  });
};
