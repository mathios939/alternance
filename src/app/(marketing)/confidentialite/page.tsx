import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/features/marketing/components/legal-page";

export const metadata: Metadata = { title: "Politique de confidentialité", description: "Comment Alternance OS traite tes données personnelles, conformément au RGPD." };

export default function PrivacyPage() {
  return (
    <LegalPage title="Politique de confidentialité" updated="9 septembre 2026">
      <section>
        <h2>1. Qui est responsable de tes données ?</h2>
        <p>Alternance OS (ci-après « nous ») est responsable du traitement des données collectées sur cette plateforme. Pour toute question : via la page Paramètres de ton compte ou l'adresse indiquée dans les mentions légales.</p>
      </section>
      <section>
        <h2>2. Quelles données collectons-nous et pourquoi ?</h2>
        <ul>
          <li><strong>Compte</strong> (email, nom, mot de passe chiffré) : pour te connecter. Base légale : exécution du contrat.</li>
          <li><strong>Profil candidat</strong> (formation, ville, compétences, mobilité, CV) : pour calculer tes scores de compatibilité et te recommander des offres. Base légale : exécution du contrat.</li>
          <li><strong>Activité</strong> (candidatures suivies, favoris, relances) : pour ton tableau de bord et tes statistiques. Base légale : exécution du contrat.</li>
          <li><strong>Conversations avec le copilote IA</strong> : pour te répondre et conserver l'historique. Seules les informations nécessaires sont transmises au fournisseur d'IA configuré. Base légale : consentement (tu choisis d'utiliser le copilote).</li>
        </ul>
        <p>Nous ne collectons aucune donnée sensible et n'effectuons aucun profilage publicitaire.</p>
      </section>
      <section>
        <h2>3. Nous ne vendons jamais tes données</h2>
        <p>Tes données ne sont ni vendues, ni louées, ni cédées à des tiers à des fins commerciales. Elles ne sont partagées qu'avec nos sous-traitants techniques (hébergement, base de données, fournisseur d'IA si tu utilises le copilote), dans le cadre strict du service.</p>
      </section>
      <section>
        <h2>4. Données concernant les entreprises et les contacts professionnels</h2>
        <p>Les informations sur les entreprises et les interlocuteurs proviennent uniquement de sources publiques ou fournies volontairement (sites carrières, API officielles, annuaires professionnels). Nous n'inventons jamais de coordonnées. Toute personne référencée peut exercer son <strong>droit d'opposition</strong>, de rectification ou de suppression : nous retirons alors la fiche sans délai.</p>
        <p>En version de démonstration, les entreprises et contacts affichés sont fictifs et signalés par un badge « Démo ».</p>
      </section>
      <section>
        <h2>5. Combien de temps conservons-nous tes données ?</h2>
        <p>Tant que ton compte est actif. Un compte inactif depuis 24 mois est supprimé après notification. Tu peux supprimer ton compte à tout moment : toutes tes données personnelles sont alors effacées définitivement.</p>
      </section>
      <section>
        <h2>6. Tes droits</h2>
        <ul>
          <li><strong>Accès et portabilité</strong> : exporte toutes tes données au format JSON depuis <Link href="/settings/privacy" className="underline">Paramètres → Confidentialité</Link>.</li>
          <li><strong>Rectification</strong> : modifie ton profil à tout moment.</li>
          <li><strong>Effacement</strong> : supprime ton compte depuis les paramètres.</li>
          <li><strong>Opposition et limitation</strong> : désactive les alertes et le copilote dans tes préférences.</li>
          <li><strong>Réclamation</strong> : tu peux saisir la CNIL (cnil.fr).</li>
        </ul>
      </section>
      <section id="cookies">
        <h2>7. Cookies</h2>
        <p>Nous utilisons uniquement des cookies <strong>strictement nécessaires</strong> : le cookie de session (connexion) et la préférence de thème (clair/sombre), stockée localement. Aucun cookie publicitaire ou de mesure d'audience tierce n'est déposé. Ces cookies ne nécessitent pas de consentement, mais tu peux les supprimer depuis ton navigateur (tu seras alors déconnecté).</p>
      </section>
      <section>
        <h2>8. Sécurité</h2>
        <p>Mots de passe hachés (scrypt), connexions chiffrées (HTTPS), validation systématique des entrées, limitation du nombre de requêtes, contrôle des fichiers importés (type et taille), accès aux données restreint à ton compte.</p>
      </section>
    </LegalPage>
  );
}
