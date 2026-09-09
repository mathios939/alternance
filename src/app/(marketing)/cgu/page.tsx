import type { Metadata } from "next";
import { LegalPage } from "@/features/marketing/components/legal-page";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

export default function TermsPage() {
  return (
    <LegalPage title="Conditions générales d'utilisation" updated="9 septembre 2026">
      <section>
        <h2>1. Objet</h2>
        <p>Alternance OS est un outil d'aide à la recherche d'alternance : agrégation d'offres, découverte d'entreprises, suivi de candidatures et assistance à la rédaction. Il ne se substitue pas aux employeurs ni aux organismes de formation et ne garantit aucun résultat.</p>
      </section>
      <section>
        <h2>2. Compte</h2>
        <p>L'inscription est gratuite et réservée aux personnes de 16 ans et plus. Tu es responsable de la confidentialité de ton mot de passe et de l'exactitude de ton profil.</p>
      </section>
      <section>
        <h2>3. Contenus et données</h2>
        <p>Les offres proviennent de sources publiques ou partenaires ; leur exactitude relève de l'émetteur. Tu peux signaler une offre expirée, fausse ou erronée depuis chaque fiche. Les contenus générés par l'IA sont des suggestions : relis-les et personnalise-les avant tout envoi. Rien n'est envoyé aux entreprises sans ton action explicite.</p>
      </section>
      <section>
        <h2>4. Usage loyal</h2>
        <p>Il est interdit d'utiliser la plateforme pour collecter massivement des données, contacter des personnes de manière abusive ou contourner les conditions d'utilisation des sites sources.</p>
      </section>
      <section>
        <h2>5. Plans</h2>
        <p>Le plan Gratuit donne accès à la recherche, aux favoris, au suivi des candidatures et aux alertes simples. Un plan Premium pourra proposer des fonctionnalités avancées ; aucun paiement n'est requis à ce jour.</p>
      </section>
      <section>
        <h2>6. Responsabilité</h2>
        <p>Le service est fourni « en l'état ». Nous mettons tout en œuvre pour sa disponibilité et sa fiabilité, sans garantie d'absence d'erreur. Notre responsabilité ne saurait être engagée pour les décisions prises sur la base des scores, estimations ou contenus générés.</p>
      </section>
    </LegalPage>
  );
}
