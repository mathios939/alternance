import { z } from "zod";
import { ContractType, EducationLevel, Mobility, RemotePolicy, WorkRhythm } from "@/generated/prisma/enums";
import { JOB_FAMILY_KEYS, SECTOR_KEYS } from "@/config/taxonomy";

export const profileSchema = z.object({
  firstName: z.string().trim().min(2, "Ton prénom (2 caractères minimum)").max(60),
  lastName: z.string().trim().max(80).optional().or(z.literal("")),
  targetJobTitle: z.string().trim().min(2, "Indique le métier que tu recherches").max(120),
  jobFamily: z.enum(JOB_FAMILY_KEYS as [string, ...string[]]).nullable().optional(),
  educationTitle: z.string().trim().max(120).optional().or(z.literal("")),
  educationLevel: z.enum(EducationLevel).nullable(),
  school: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Indique ta ville").max(80),
  mobility: z.enum(Mobility),
  hasDrivingLicense: z.boolean(),
  hasVehicle: z.boolean(),
  maxRadiusKm: z.number().int().min(5).max(100),
  remotePreference: z.enum(RemotePolicy).nullable(),
  startDate: z.string().nullable(),
  durationMonths: z.number().int().nullable(),
  rhythm: z.enum(WorkRhythm).nullable(),
  contractTypes: z.array(z.enum(ContractType)).max(2),
  skills: z.array(z.string().trim().min(1).max(60)).max(40),
  sectors: z.array(z.enum(SECTOR_KEYS as [string, ...string[]])).max(10),
  bio: z.string().trim().max(600).optional().or(z.literal("")),
  linkedinUrl: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  weeklyGoal: z.number().int().min(1).max(100).optional(),
  schoolCity: z.string().trim().max(80).optional().or(z.literal("")),
});

export type ProfileInput = z.input<typeof profileSchema>;
export type ProfileValues = z.infer<typeof profileSchema>;

export const DEFAULT_PROFILE_VALUES: ProfileValues = {
  firstName: "",
  lastName: "",
  targetJobTitle: "",
  jobFamily: null,
  educationTitle: "",
  educationLevel: null,
  school: "",
  city: "",
  mobility: "DEPARTMENT",
  hasDrivingLicense: false,
  hasVehicle: false,
  maxRadiusKm: 30,
  remotePreference: null,
  startDate: null,
  durationMonths: 24,
  rhythm: null,
  contractTypes: ["APPRENTISSAGE"],
  skills: [],
  sectors: [],
  bio: "",
  linkedinUrl: "",
  phone: "",
  weeklyGoal: 20,
  schoolCity: "",
};
