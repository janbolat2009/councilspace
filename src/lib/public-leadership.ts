// Public display names only. These settings never grant account permissions.
export const PUBLIC_MINISTER_NAMES: Readonly<Record<string, string>> = {
  sport: "Temirlan Sagat",
  "finance-external-affairs": "Nurali Baibossynov",
  management: "Dilnaz Idrissova",
  volunteering: "Aizere Uakhit",
  "mass-media": "Zhaniya Yerken",
  mentorship: "Aiya Zhumagali"
};

export const PUBLIC_COUNSELOR_NAME = "Medina Alzhanova";

export function publicMinisterName(slug: string, storedName = "") {
  return PUBLIC_MINISTER_NAMES[slug] ?? storedName;
}
