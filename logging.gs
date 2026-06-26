/**
 * Enregistre une ligne de suivi dans le tableau de bord Google Sheets
 * @param {string} threadId - L'ID du fil de discussion Gmail
 * @param {string} sender - L'expéditeur du message
 * @param {string} subject - L'objet du message
 * @param {string} category - La catégorie détectée par l'IA
 * @param {string} status - Le statut de l'action (ex: "Traité", "Erreur")
 */

function logToDashboard(threadId, sender, subject, category, status) {
  const receiver = Session.getActiveUser().getEmail();
  console.log("[logToDashboard] " + threadId);
  
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheets()[0]; // Récupère la première feuille
    
    const timestamp = new Date();
    
    // Ajoute les données à la fin du tableau
    sheet.appendRow([
      timestamp, 
      threadId, 
      sender,
      receiver, 
      subject, 
      category, 
      status
    ]);
    
    console.log("Log enregistré avec succès dans le Sheets.");
  } catch (error) {
    console.error("Erreur lors de l'enregistrement dans le tableau de bord : " + error.toString());
  }
}