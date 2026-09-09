import type { Metadata } from "next";
import { LegalPage } from "@/features/marketing/components/legal-page";

export const metadata: Metadata = { title: "Mentions légales" };

export default function LegalNoticePage() {
  return (
    <LegalPage title="Mentions légales" updated="9 septembre 2026">
      <section>
        <h2>Éditeur</h2>
        <p>Alternance OS — projet en cours de développement. Les informations d'identification de l'éditeur (raison sociale, siège, contact) seront renseignées avant toute mise en production publique.</p>
      </section>
      <section>
        <h2>Hébergement</h2>
        <p>Application déployable sur Vercel (frontend et API) avec une base PostgreSQL managée (Neon, Supabase, Railway ou équivalent), hébergée dans l'Union européenne lorsque l'option est disponible.</p>
      </section>
      <section>
        <h2>Données de démonstration</h2>
        <p>En mode démonstration, toutes les entreprises, offres, contacts et témoignages sont fictifs. Toute ressemblance avec des organisations ou personnes réelles serait fortuite.</p>
      </section>
    </LegalPage>
  );
}
