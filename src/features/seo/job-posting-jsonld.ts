import { siteConfig } from "@/config/site";
import { CONTRACT_TYPES, educationLabel } from "@/config/taxonomy";
import type { JobDetail } from "@/features/jobs/server/queries";

/** JSON-LD JobPosting (schema.org) pour une offre. Les offres démo sont exclues de l'indexation en amont. */
export function buildJobPostingJsonLd(job: JobDetail) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description.replace(/\n/g, "<br/>"),
    datePosted: job.publishedAt.toISOString(),
    validThrough: job.expiresAt?.toISOString(),
    employmentType: "APPRENTICESHIP",
    hiringOrganization: {
      "@type": "Organization",
      name: job.company.name,
      sameAs: job.company.website ?? undefined,
      logo: job.company.logoUrl ?? undefined,
    },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: job.city, postalCode: job.postalCode ?? undefined, addressRegion: job.region ?? undefined, addressCountry: "FR" },
      ...(job.latitude !== null && job.longitude !== null ? { geo: { "@type": "GeoCoordinates", latitude: job.latitude, longitude: job.longitude } } : {}),
    },
    ...(job.remote === "FULL" ? { jobLocationType: "TELECOMMUTE" } : {}),
    ...(job.salaryMin
      ? { baseSalary: { "@type": "MonetaryAmount", currency: "EUR", value: { "@type": "QuantitativeValue", minValue: job.salaryMin, maxValue: job.salaryMax ?? job.salaryMin, unitText: "MONTH" } } }
      : {}),
    educationRequirements: job.educationLevelMin ? { "@type": "EducationalOccupationalCredential", credentialCategory: educationLabel(job.educationLevelMin) } : undefined,
    skills: job.skills.map((s) => s.skill.name).join(", "),
    identifier: { "@type": "PropertyValue", name: siteConfig.name, value: job.id },
    url: `${siteConfig.url}/jobs/${job.slug}`,
    directApply: Boolean(job.applicationUrl),
    incentiveCompensation: CONTRACT_TYPES[job.contractType].label,
  };
}
