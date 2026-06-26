// Constantes globales

const SYSTEM_PROMPT = `
You are an advanced email assistant. Analyze the incoming email thread.
You must return a strict JSON object with exactly two keys:
1. "is_ad": (boolean) true if the email is a commercial ad, spam, newsletter, or automated marketing. false otherwise.
2. "reply": (string) If "is_ad" is false, draft a professional reply. If "is_ad" is true, leave this field empty "".

Strict constraints for the "reply":`;

const DEFAULT_REDACT_PROMPT = `
1. Concision : Allez droit au but. Privilégiez des phrases courtes, claires et une structure directe. Évitez les paragraphes trop denses.

2. Orientation solutions (sans justification) : Si l'expéditeur exprime un mécontentement ou un problème, ne cherchez pas à argumenter, à débattre ou à vous étendre en excuses. Concentrez-vous uniquement sur une reconnaissance objective de la situation et proposez immédiatement les prochaines étapes ou des solutions concrètes.

3. Courtoisie sobre : Utilisez les formules de politesse professionnelles d'usage, mais restez mesuré. Évitez les tournures trop lourdes, chaleureuses ou pompeuses.

4. Fin directe (sans bloc de signature) : Ne signez pas l'e-mail. N'ajoutez aucun nom, nom d'entreprise ou formule de congé finale (comme "Cordialement"). Le texte doit s'interrompre immédiatement après la dernière phrase du message.`;

const END_PROMPT = `
Respond ONLY with the JSON object. Do not add any text before or after.
`;

const INTERNAL_DOMAINS = ["@mazet-sa.com", "@boetiepartners.com"];

// le nombre de mails auquels il va avoir accès dans l'historique de celui auquel il répond
const CONTEXT_LENGTH = 7;

// le nombre de mails qui vont être traités par run
const DEPTH = 10;

const SPREADSHEET_ID = "example";

/**
 * Vide complètement toutes les UserProperties de l'utilisateur actuel
 */
function debugResetAllUserProperties() {
  const userProperties = PropertiesService.getUserProperties();
  
  console.log("--- AVANT RESET ---");
  console.log(userProperties.getProperties());
  
  // Correction ici : on utilise la méthode native d'Apps Script
  userProperties.deleteAllProperties();
  
  console.log("--- APRÈS RESET ---");
  console.log(userProperties.getProperties());
  console.log("Base propre !");
}

/**
 * Filtre les réponses automatiques (Ex: messages d'absence)
 */
function filterAutomaticReply(lastMessage) {
  const senderAdress = lastMessage.getFrom().toLowerCase();
  const subject = lastMessage.getSubject().toLowerCase();
  if (subject.includes("réponse automatique") 
  || subject.includes("automatic reply") 
  || subject.includes("absent")
  || senderAdress.includes("notification")
  || senderAdress.includes("noreply")
  || senderAdress.includes("support")
  ) {
    return false; // C'est un bot, on ne veut pas l'analyser
  }
  return true;
}


function testSoloAskAI() {
  // Récupère le tout premier thread de votre boîte de réception pour le test
  var mockThread = GmailApp.getInboxThreads(0, 1)[0]; 
  // Appelle askAI avec un vrai thread et un prompt
  var rep = askAI(mockThread, "Dis bonjour");
  console.log(rep);
}

// fonctions de debug ==================================
function listAvailableModels() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    console.error("Clé API manquante. Configurez 'GEMINI_API_KEY' dans les paramètres du script.");
    return;
  }
  
  // Requête sur le endpoint racine des modèles
  const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
  
  
  console.log("Interrogation de la liste des modèles Google AI Studio...");
  
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const json = JSON.parse(response.getContentText());
  
  if (json.models) {
    console.log("=== MODÈLES DISPONIBLES COMPATIBLES ===");
    json.models.forEach(model => {
      // On ne garde que les modèles qui supportent la génération de contenu textuel
      if (model.supportedGenerationMethods && model.supportedGenerationMethods.includes("generateContent")) {
        // model.name ressemble à "models/gemini-1.5-flash" ou "models/gemini-2.0-flash"
        console.log(`ID à utiliser : ${model.name} (${model.displayName})`);
      }
    });
    console.log("=======================================");
  } else {
    console.error("Impossible de récupérer la liste. Réponse du serveur :", response.getContentText());
  }
}