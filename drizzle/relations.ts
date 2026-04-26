import { relations } from "drizzle-orm/relations";
import {
  artCategories,
  artSubcategories,
  artTechniques,
  tags,
  promptTags,
  prompts,
  styleTechniqueRecs,
  styles,
  styleFamilies,
  generations,
  generationRatings,
  promptVersions,
  sessions,
  sessionMessages,
  imageAttributes,
  imageTags,
  stacks,
  collections,
  collectionImages,
} from "./schema";

export const artSubcategoriesRelations = relations(
  artSubcategories,
  ({ one, many }) => ({
    artCategory: one(artCategories, {
      fields: [artSubcategories.categoryId],
      references: [artCategories.id],
    }),
    artTechniques: many(artTechniques),
  }),
);

export const artCategoriesRelations = relations(artCategories, ({ many }) => ({
  artSubcategories: many(artSubcategories),
}));

export const artTechniquesRelations = relations(
  artTechniques,
  ({ one, many }) => ({
    artSubcategory: one(artSubcategories, {
      fields: [artTechniques.subcategoryId],
      references: [artSubcategories.id],
    }),
    styleTechniqueRecs: many(styleTechniqueRecs),
  }),
);

export const promptTagsRelations = relations(promptTags, ({ one }) => ({
  tag: one(tags, {
    fields: [promptTags.tagId],
    references: [tags.id],
  }),
  prompt: one(prompts, {
    fields: [promptTags.promptId],
    references: [prompts.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  promptTags: many(promptTags),
  imageTags: many(imageTags),
}));

export const promptsRelations = relations(prompts, ({ one, many }) => ({
  promptTags: many(promptTags),
  generations: many(generations),
  promptVersions: many(promptVersions),
  style: one(styles, {
    fields: [prompts.styleId],
    references: [styles.id],
  }),
}));

export const styleTechniqueRecsRelations = relations(
  styleTechniqueRecs,
  ({ one }) => ({
    artTechnique: one(artTechniques, {
      fields: [styleTechniqueRecs.techniqueId],
      references: [artTechniques.id],
    }),
    style: one(styles, {
      fields: [styleTechniqueRecs.styleId],
      references: [styles.id],
    }),
  }),
);

export const stylesRelations = relations(styles, ({ one, many }) => ({
  styleTechniqueRecs: many(styleTechniqueRecs),
  styleFamily: one(styleFamilies, {
    fields: [styles.familyId],
    references: [styleFamilies.id],
  }),
  prompts: many(prompts),
}));

export const styleFamiliesRelations = relations(styleFamilies, ({ many }) => ({
  styles: many(styles),
}));

export const generationRatingsRelations = relations(
  generationRatings,
  ({ one }) => ({
    generation: one(generations, {
      fields: [generationRatings.generationId],
      references: [generations.id],
    }),
  }),
);

export const generationsRelations = relations(generations, ({ one, many }) => ({
  generationRatings: many(generationRatings),
  prompt: one(prompts, {
    fields: [generations.promptId],
    references: [prompts.id],
  }),
}));

export const promptVersionsRelations = relations(promptVersions, ({ one }) => ({
  prompt: one(prompts, {
    fields: [promptVersions.promptId],
    references: [prompts.id],
  }),
}));

export const sessionMessagesRelations = relations(
  sessionMessages,
  ({ one }) => ({
    session: one(sessions, {
      fields: [sessionMessages.sessionId],
      references: [sessions.id],
    }),
  }),
);

export const sessionsRelations = relations(sessions, ({ many }) => ({
  sessionMessages: many(sessionMessages),
}));

export const stacksRelations = relations(stacks, ({ many }) => ({
  imageAttributes: many(imageAttributes),
}));

export const imageAttributesRelations = relations(
  imageAttributes,
  ({ one }) => ({
    stack: one(stacks, {
      fields: [imageAttributes.stackId],
      references: [stacks.id],
    }),
  }),
);

export const imageTagsRelations = relations(imageTags, ({ one }) => ({
  tag: one(tags, {
    fields: [imageTags.tagId],
    references: [tags.id],
  }),
}));

export const collectionsRelations = relations(collections, ({ many }) => ({
  collectionImages: many(collectionImages),
}));

export const collectionImagesRelations = relations(
  collectionImages,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionImages.collectionId],
      references: [collections.id],
    }),
  }),
);
