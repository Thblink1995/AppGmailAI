function buildHomepage(e) {
  const myEmail = Session.getActiveUser().getEmail();
  console.log("[buildHomepage] init " + myEmail);
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle("Assistant Email"));
 
  // ==========================================
  // SECTION 1 : ACTION RAPIDE
  // ==========================================
  var sectionActions = CardService.newCardSection().setHeader("Action rapide");
  var btnLancement = CardService.newTextButton()
      .setText("▶ Lancer le tri maintenant")
      .setOnClickAction(CardService.newAction().setFunctionName("runManualTriage"))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED);
  sectionActions.addWidget(CardService.newButtonSet().addButton(btnLancement));
  card.addSection(sectionActions);
 
  // ==========================================
  // SECTION 2 : NAVIGATION
  // ==========================================
  var sectionNav = CardService.newCardSection().setHeader("Configuration");
 
  var btnPlanning = CardService.newTextButton()
      .setText("⚙️  Planification automatique")
      .setOnClickAction(CardService.newAction().setFunctionName("buildPlanningCard"))
      .setTextButtonStyle(CardService.TextButtonStyle.OUTLINED);
 
  var btnPrompt = CardService.newTextButton()
      .setText("✏️  Consignes de rédaction IA")
      .setOnClickAction(CardService.newAction().setFunctionName("buildPromptCard"))
      .setTextButtonStyle(CardService.TextButtonStyle.OUTLINED);
 
  sectionNav.addWidget(CardService.newButtonSet().addButton(btnPlanning));
  sectionNav.addWidget(CardService.newButtonSet().addButton(btnPrompt));
  card.addSection(sectionNav);
 
  return card.build();
}
 
/**
 * CARTE PLANIFICATION
 * Trigger on/off + fréquence d'exécution
 */
function buildPlanningCard(e) {
  const userProperties = PropertiesService.getUserProperties();
  const isTriggerActive = userProperties.getProperty('TRIGGER_ACTIVE') === 'true';
  const triggerHours = userProperties.getProperty('TRIGGER_HOURS') || '1';
 
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle("⚙️ Planification automatique"));
 
  var sectionTrigger = CardService.newCardSection().setHeader("Tri en arrière-plan (Min. 1h)");
 
  var switchWidget = CardService.newSwitch()
      .setFieldName("trigger_switch")
      .setValue("active")
      .setSelected(isTriggerActive);
  var toggleRow = CardService.newDecoratedText()
      .setText("Activer le tri automatique")
      .setSwitchControl(switchWidget);
  sectionTrigger.addWidget(toggleRow);
 
  var dropdownHours = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName("trigger_hours")
      .setTitle("Fréquence d'exécution");
  dropdownHours.addItem("Toutes les heures", "1", triggerHours === "1");
  dropdownHours.addItem("Toutes les 2 heures", "2", triggerHours === "2");
  dropdownHours.addItem("Toutes les 4 heures", "4", triggerHours === "4");
  sectionTrigger.addWidget(dropdownHours);
  card.addSection(sectionTrigger);
 
  // Sauvegarde
  var sectionSave = CardService.newCardSection();
  var btnSave = CardService.newTextButton()
      .setText("Enregistrer")
      .setOnClickAction(CardService.newAction().setFunctionName("savePlanningConfig"))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED);
  sectionSave.addWidget(CardService.newButtonSet().addButton(btnSave));
  card.addSection(sectionSave);
 
  return card.build();
}
 
/**
 * CARTE PROMPT
 * Option 1 (Google Doc) + Option 2 (saisie directe)
 * En-têtes et hints dynamiques selon l'option active
 */
function buildPromptCard(e) {
  const userProperties = PropertiesService.getUserProperties();
  const docUrl = userProperties.getProperty('CUSTOM_PROMPT_DOC_URL') || '';
  const directPrompt = userProperties.getProperty('CUSTOM_PROMPT_TEXT') || getDefaultPromptFallback();
  const isDocUrlActive = docUrl.trim() !== '';
 
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle("✏️ Consignes de rédaction IA"));
 
  // --- Option 1 : Google Doc ---
  const headerOption1 = "Option 1 — Google Doc";
      
  var sectionPromptDoc = CardService.newCardSection().setHeader(headerOption1);
 
  const hintDoc = isDocUrlActive
      ? "✅ Ce lien est actuellement utilisé comme source du prompt."
      : "Laissez vide pour utiliser la saisie directe (Option 2).";
 
  var urlInput = CardService.newTextInput()
      .setFieldName("prompt_doc_url")
      .setTitle("Lien URL d'un Google Doc")
      .setHint(hintDoc)
      .setMultiline(false)
      .setValue(docUrl);
  sectionPromptDoc.addWidget(urlInput);
  card.addSection(sectionPromptDoc);
 
  // --- Option 2 : Saisie directe ---
  const headerOption2 = "Option 2 — Saisie directe";
 
  var sectionPromptText = CardService.newCardSection().setHeader(headerOption2);
 
  const hintText = isDocUrlActive
      ? "⚠️ Ignoré : un lien Google Doc est défini en Option 1."
      : "✅ Utilisé comme source du prompt. Sera remplacé si vous renseignez un lien en Option 1.";
 
  var textInput = CardService.newTextInput()
      .setFieldName("prompt_text_input")
      .setTitle("Consignes de rédaction")
      .setHint(hintText)
      .setMultiline(true)
      .setValue(directPrompt);
  sectionPromptText.addWidget(textInput);
  card.addSection(sectionPromptText);
 
  // Sauvegarde
  var sectionSave = CardService.newCardSection();
  var btnSave = CardService.newTextButton()
      .setText("Enregistrer")
      .setOnClickAction(CardService.newAction().setFunctionName("savePromptConfig"))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED);
  sectionSave.addWidget(CardService.newButtonSet().addButton(btnSave));
  card.addSection(sectionSave);
 
  return card.build();
}
 
/**
 * SAUVEGARDE — Planification uniquement
 */
function savePlanningConfig(e) {
  const userProperties = PropertiesService.getUserProperties();
  const isSelected = e.formInput.trigger_switch === "active";
  const hours = e.formInput.trigger_hours || "1";
 
  userProperties.setProperty('TRIGGER_ACTIVE', isSelected ? 'true' : 'false');
  userProperties.setProperty('TRIGGER_HOURS', hours);
  manageHourlyTrigger(isSelected, hours);
 
  return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Planification enregistrée !"))
      .setNavigation(CardService.newNavigation().updateCard(buildPlanningCard(e)))
      .build();
}
 
/**
 * SAUVEGARDE — Prompt uniquement
 */
function savePromptConfig(e) {
  const userProperties = PropertiesService.getUserProperties();
  const docUrl = e.formInput.prompt_doc_url || "";
  const textPrompt = e.formInput.prompt_text_input || "";
 
  userProperties.setProperty('CUSTOM_PROMPT_DOC_URL', docUrl);
  userProperties.setProperty('CUSTOM_PROMPT_TEXT', textPrompt);
 
  return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Consignes enregistrées !"))
      .setNavigation(CardService.newNavigation().updateCard(buildPromptCard(e)))
      .build();
}

function manageHourlyTrigger(activate, hours) {
  const functionName = "executeEmailTriage";
  const triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  if (activate) {
    ScriptApp.newTrigger(functionName).timeBased().everyHours(parseInt(hours, 10)).create();
  }
}


function runManualTriage(e) {
  try {
    const stats = executeEmailTriage(); // retourne un objet stats 
    const msg = `✅ Tri terminé — ${stats.drafted} brouillon(s) créé(s), ${stats.ignored} ignoré(s)`;
    return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText(msg))
        .build();
  } catch (error) {
    return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText("❌ Erreur : " + error.message))
        .build();
  }
}

function getDefaultPromptFallback() {
  return DEFAULT_REDACT_PROMPT;
}