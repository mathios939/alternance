/** Contexte minimal transmis à l'IA : uniquement ce qui est nécessaire à la tâche. */
export type CopilotContext = {
  profile: {
    firstName: string;
    lastName: string | null;
    targetJobTitle: string | null;
    educationTitle: string | null;
    educationLevel: string | null;
    school: string | null;
    city: string | null;
    phone: string | null;
    startDate: string | null;
    durationMonths: number | null;
    rhythm: string | null;
    skills: string[];
    bio: string | null;
    experiences: Array<{ title: string; company: string; description: string | null }>;
    completion: number;
  };
  resume?: { title: string; score: number | null; excerpt: string; improvements?: string[] } | null;
  job?: { id: string; slug: string; title: string; companyName: string; city: string; skills: string[]; missions: string[]; requirements: string[]; description: string; matchScore: number | null; matchReasons: string[] } | null;
  company?: { name: string; description: string | null; sector: string | null; size: string | null; technologies: string[]; city: string; recommendedContact: { firstName: string; lastName: string; jobTitle: string } | null } | null;
  application?: { status: string; appliedAt: string | null; daysSinceApplied: number | null; followUpCount: number } | null;
  topJobs?: Array<{ title: string; companyName: string; city: string; matchScore: number; slug: string; reasons: string[] }>;
  companies?: Array<{ name: string; city: string; opportunityScore: number; slug: string; reason: string | null }>;
  followUps?: Array<{ companyName: string; jobTitle: string | null; daysSinceApplied: number }>;
  interviews?: Array<{ companyName: string; scheduledAt: string; jobTitle: string | null }>;
  stats?: { applicationsSent: number; responses: number; responseRate: number; interviews: number };
};
