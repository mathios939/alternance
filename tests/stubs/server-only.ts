/**
 * Remplace le paquet `server-only` dans Vitest : les tests d'intégration importent des modules
 * serveur (requêtes, import des favoris) qui déclarent `import "server-only"`. Hors de Next.js,
 * cette garde n'a pas de sens ; le paquet réel lèverait une erreur.
 */
export {};
