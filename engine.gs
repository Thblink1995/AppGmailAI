function executeEmailTriage(){
  return main();
}

function main() {
  // pour retour utilisateur
  let stats = { drafted: 0, ignored: 0 };

  const myEmail = Session.getActiveUser().getEmail();
  const threads = GmailApp.search("is:inbox is:unread -label:ia-traite", 0, DEPTH);
  const labelTraite = GmailApp.getUserLabelByName("ia-traite") || GmailApp.createLabel("ia-traite");

  console.log("[Main] " + threads.length + " emails à traiter");

  // Une seule boucle FOR propre pour permettre l'usage de "continue"
  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const messages = thread.getMessages();
    
    // On extrait les infos spécifiques au thread ACTUEL de la boucle
    const firstMessage = messages[0];
    const sender = firstMessage.getFrom();
    const subject = firstMessage.getSubject();
    const threadId = thread.getId();
    
    try {
      const lastMessage = messages[messages.length - 1];
      const fromAddress = lastMessage.getFrom().toLowerCase();
      const toAddress = lastMessage.getTo().toLowerCase();

      // Critères de filtrage
      const isInternal = INTERNAL_DOMAINS.some(domain => fromAddress.includes(domain));
      const isToMe = toAddress.includes(myEmail.toLowerCase());
      const isAutoReply = lastMessage.getSubject().toLowerCase().includes("réponse automatique")
        || fromAddress.includes("noreply")
        || fromAddress.includes("no-reply")
        || fromAddress.includes("notification");

      // Requête API pour un brouillon
      if (!isInternal && isToMe && !isAutoReply) {

        // Résolution du prompt actif
        const userProperties = PropertiesService.getUserProperties();
        const docUrl = userProperties.getProperty('CUSTOM_PROMPT_DOC_URL') || '';
        let customPrompt = userProperties.getProperty('CUSTOM_PROMPT_TEXT') || DEFAULT_REDACT_PROMPT;

        if (docUrl.trim() !== '') {
          try {
            const doc = DocumentApp.openByUrl(docUrl);
            customPrompt = doc.getBody().getText();
          } catch(err) {
            console.warn("[Main] Impossible de lire le Google Doc, fallback sur saisie directe : " + err.message);
          }
        }

        const activePrompt = SYSTEM_PROMPT + customPrompt + END_PROMPT;
        const aiResult = askAI(thread, activePrompt);
        
        if (aiResult == null) {
          console.log("[Main] pas de réponse d'IA");
          logToDashboard(threadId, sender, subject, "Erreur API", "Échec");
          continue; 
        }

        console.log(aiResult);
        
        // Parsing et traitement du résultat de l'IA
        try {
          let cleanJsonText = aiResult.trim();
          const jsonMatch = cleanJsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            cleanJsonText = jsonMatch[0];
          }

          const data = JSON.parse(cleanJsonText);
          
          if (!data.is_ad && data.reply && data.reply.trim() !== "") {
            lastMessage.createDraftReplyAll(data.reply);
            stats.drafted++;
            logToDashboard(threadId, sender, subject, data.category || "Triage", "Brouillon écrit");
            console.log(`[Main] Brouillon créé avec succès pour ${fromAddress}`);
          } else {
            stats.ignored++;
            logToDashboard(threadId, sender, subject, data.category || "Publicité/Inutile", "Ignoré");
            console.log(`[Main] Mail ignoré (Détecté comme Pub ou réponse vide) pour ${fromAddress}`);
          }
        } catch(e) {
          console.error("[Main] Échec du parsing JSON. Contenu brut de l'IA : " + aiResult);
          logToDashboard(threadId, sender, subject, "Erreur Parsing JSON", "Échec");
        }
        
      } else {
        console.log("[Main] Mail n°" + i + " ignoré par les filtres");
        stats.ignored++;
        logToDashboard(threadId, sender, subject, "Filtre Interne/Auto", "Ignoré");
      }

      // Sécurité : On marque le mail comme traité quoi qu'il arrive
      thread.addLabel(labelTraite);

    } catch(e) {
      // Correction de la faute de frappe ici (remplacement du = par une virgule)
      logToDashboard(threadId, sender, subject, "Erreur Script", e.message);
      console.error(`[Main] Erreur sur thread ${i} : ${e.message}`);
      
      // Sécurité anti-boucle infinie
      try { thread.addLabel(labelTraite); } catch(_) {}
    }
  }

  console.log("[Main] stats renvoyées");
  return stats;
}

function askAI(thread, promptText) {
  // enrichi le contexte et fait une requête API à Gemini
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
  
  const messages = thread.getMessages();
  const threadSubject = thread.getFirstMessageSubject();
  let threadContext = `Topic : ${threadSubject}\n====================\n`;
  
  const startIdx = Math.max(0, messages.length - CONTEXT_LENGTH);
  for (let i = startIdx; i < messages.length; i++) {
    threadContext += `From: ${messages[i].getFrom()}\nText:\n${messages[i].getPlainBody()}\n-----------\n`;
  }

  const payload = {
    contents: [{ parts: [{ text: promptText + "\n\nEmail:\n" + threadContext }] }]
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  console.log("[askAI] Envoi de la requête simplifiée...");
  const response = UrlFetchApp.fetch(url, options);
  const statusCode = response.getResponseCode();
  
  if (statusCode === 200) {
    console.log("[askAI] statusCode = 200");
    return JSON.parse(response.getContentText()).candidates[0].content.parts[0].text;

  } else {
    console.error(`[askAI] Erreur HTTP ${statusCode}: ` + response.getContentText());
    return null;
  }
}