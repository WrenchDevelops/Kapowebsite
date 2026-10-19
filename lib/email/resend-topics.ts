import { commerceEnv } from "../commerce/env.ts";
import type { Preferences, TopicId } from "./topics.ts";

export function resendTopicId(topic: string) {
  const settings = commerceEnv();
  switch (topic) {
    case "products":
      return settings.resendTopicProducts;
    case "deals":
      return settings.resendTopicDeals;
    case "youtube":
      return settings.resendTopicYoutube;
    case "instagram":
      return settings.resendTopicInstagram;
    case "news":
      return settings.resendTopicNews;
    default:
      return "";
  }
}

export function topicSubscriptions(preferences: Preferences) {
  const topics: TopicId[] = ["products", "deals", "youtube", "instagram", "news"];
  return topics.flatMap((topic) => {
    const id = resendTopicId(topic);
    if (!id) return [];
    return [{ id, subscription: preferences[topic] ? "opt_in" as const : "opt_out" as const }];
  });
}
