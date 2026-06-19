export const PROFESSIONI = [
  { id: 'webdev', label: 'Sviluppatore Web' },
  { id: 'designer', label: 'Graphic Designer' },
  { id: 'marketing', label: 'Consulente Marketing' },
  { id: 'commercialista', label: 'Commercialista' },
  { id: 'avvocato', label: 'Avvocato / Studio Legale' },
  { id: 'architetto', label: 'Architetto' },
  { id: 'fotografo', label: 'Fotografo' },
  { id: 'social', label: 'Social Media Manager' },
  { id: 'videomaker', label: 'Videomaker' },
  { id: 'seo', label: 'Consulente SEO' },
  { id: 'altro', label: 'Altro' },
];

function makeId() {
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export const DEFAULT_TEMPLATES = [
  {
    id: makeId(), title: 'Sviluppo Sito Web', client: '', status: 'Bozza',
    date: new Date().toISOString().slice(0, 10), owner: '',
    intro: 'Preventivo per la realizzazione di un sito web professionale, comprensivo di progettazione, sviluppo e ottimizzazione.',
    color: '#0B57D0', vat: 22, isTemplate: true, isGlobal: true, owner: 'admin@gmail.com',
    options: [
      { id: 'opt_1', title: 'Sito Vetrina', description: 'Sito one-page con chi siamo, servizi, contatti e modulo richiesta.', oneTimeCost: 1200, monthlyCost: 0 },
      { id: 'opt_2', title: 'Sito Multi-pagina', description: 'Sito fino a 5 pagine con CMS, blog e form contatti avanzato.', oneTimeCost: 2500, monthlyCost: 0 },
      { id: 'opt_3', title: 'E-commerce Base', description: 'Negozio online fino a 50 prodotti, carrello e pagamenti online.', oneTimeCost: 3500, monthlyCost: 0 },
      { id: 'opt_4', title: 'Manutenzione Annuale', description: 'Aggiornamenti CMS, backup mensili, monitoraggio sicurezza e supporto tecnico.', oneTimeCost: 0, monthlyCost: 80 },
      { id: 'opt_5', title: 'SEO On-page', description: 'Analisi parole chiave, ottimizzazione contenuti, meta tag e velocity.', oneTimeCost: 500, monthlyCost: 0 },
    ],
    clauses: [
      { id: 'cl_1', title: 'Tempistiche', body: 'Consegna progetto stimata in 15-25 giorni lavorativi dalla conferma dell\'ordine.' },
      { id: 'cl_2', title: 'Garanzia', body: 'Garanzia di 6 mesi su eventuali bug di sviluppo, esclusi contenuti inseriti dal cliente.' },
    ],
  },
  {
    id: makeId(), title: 'Progetto Grafico', client: '', status: 'Bozza',
    date: new Date().toISOString().slice(0, 10), owner: '',
    intro: 'Preventivo per servizi di graphic design: identità visiva, materiale cartaceo e digitale.',
    color: '#7C3AED', vat: 22, isTemplate: true, isGlobal: true, owner: 'admin@gmail.com',
    options: [
      { id: 'opt_1', title: 'Logo + Brand Identity', description: 'Logo principale, varianti colore, palette, tipografia e manuale d\'uso essenziale.', oneTimeCost: 800, monthlyCost: 0 },
      { id: 'opt_2', title: 'Biglietti da Visita', description: 'Design e stampa 250 biglietti fronte/retro in carta pregiata 350g.', oneTimeCost: 250, monthlyCost: 0 },
      { id: 'opt_3', title: 'Social Kit', description: 'Template storie, post quadrati, cover Facebook/LinkedIn e banner Instagram.', oneTimeCost: 400, monthlyCost: 0 },
      { id: 'opt_4', title: 'Brochure A4', description: 'Brochure pieghevole 3 ante, stampa 500 copie in quadricromia.', oneTimeCost: 900, monthlyCost: 0 },
      { id: 'opt_5', title: 'Manutenzione Identità', description: 'Aggiornamenti periodici e nuove declinazioni del marchio.', oneTimeCost: 0, monthlyCost: 60 },
    ],
    clauses: [
      { id: 'cl_1', title: 'Revisioni', body: 'Sono incluse fino a 2 revisioni gratuite per ogni deliverable. Revisioni extra: 50€ cadauna.' },
      { id: 'cl_2', title: 'Diritti d\'uso', body: 'I diritti d\'uso del marchio vengono ceduti al saldo finale del progetto.' },
    ],
  },
  {
    id: makeId(), title: 'Consulenza Marketing Digitale', client: '', status: 'Bozza',
    date: new Date().toISOString().slice(0, 10), owner: '',
    intro: 'Strategia marketing digitale su misura per far crescere il tuo business online.',
    color: '#F59E0B', vat: 22, isTemplate: true, isGlobal: true, owner: 'admin@gmail.com',
    options: [
      { id: 'opt_1', title: 'Audit Marketing', description: 'Analisi completo canali digitali, competitor audit e report con raccomandazioni.', oneTimeCost: 500, monthlyCost: 0 },
      { id: 'opt_2', title: 'Strategia Trimestrale', description: 'Piano editoriale, calendario contenuti, strategia canali e KPI mensili.', oneTimeCost: 0, monthlyCost: 600 },
      { id: 'opt_3', title: 'Advertising ADS', description: 'Gestione campagne Google/Facebook/Instagram con budget a carico del cliente.', oneTimeCost: 300, monthlyCost: 400 },
      { id: 'opt_4', title: 'Email Marketing', description: 'Setup Mailchimp, sequence automation, 2 newsletter/mese e report.', oneTimeCost: 200, monthlyCost: 250 },
      { id: 'opt_5', title: 'Consulenza One-shot', description: 'Sessione strategica 2h con piano d\'azione personalizzato.', oneTimeCost: 350, monthlyCost: 0 },
    ],
    clauses: [
      { id: 'cl_1', title: 'Durata', body: 'Contratto trimestrale con rinnovo tacito salvo disdetta 30 giorni prima della scadenza.' },
    ],
  },
  {
    id: makeId(), title: 'Servizi Commercialista', client: '', status: 'Bozza',
    date: new Date().toISOString().slice(0, 10), owner: '',
    intro: 'Servizi contabili e fiscali per partite IVA e professionisti. Trasparenza e competenza.',
    color: '#10B981', vat: 22, isTemplate: true, isGlobal: true, owner: 'admin@gmail.com',
    options: [
      { id: 'opt_1', title: 'Contabilità Ordinaria', description: 'Tenuta contabilità, registrazioni IVA, libro giornale e inventari.', oneTimeCost: 0, monthlyCost: 120 },
      { id: 'opt_2', title: 'Dichiarazione Redditi', description: 'Preparazione e invio dichiarazione annuale PF o SP.', oneTimeCost: 350, monthlyCost: 0 },
      { id: 'opt_3', title: 'Consulenza Fiscale', description: 'Supporto continuativo su tematiche fiscali, tax planning e adempimenti.', oneTimeCost: 0, monthlyCost: 80 },
      { id: 'opt_4', title: 'Paghe e Contributi', description: 'Elaborazione cedolini paga, UNIEMENS e adempimenti mensili per 1-5 dipendenti.', oneTimeCost: 0, monthlyCost: 50 },
      { id: 'opt_5', title: 'Apertura Partita IVA', description: 'Pratica completa apertura partita IVA, scelta regime e primo anno assistito.', oneTimeCost: 400, monthlyCost: 0 },
    ],
    clauses: [
      { id: 'cl_1', title: 'Privacy', body: 'I dati del cliente saranno trattati nel pieno rispetto del GDPR e della normativa sulla privacy.' },
    ],
  },
  {
    id: makeId(), title: 'Prestazione Legale', client: '', status: 'Bozza',
    date: new Date().toISOString().slice(0, 10), owner: '',
    intro: 'Preventivo per prestazioni legali: assistenza, pareri e contenzioso.',
    color: '#EF4444', vat: 22, isTemplate: true, isGlobal: true, owner: 'admin@gmail.com',
    options: [
      { id: 'opt_1', title: 'Parere Legale Scritto', description: 'Analisi del caso e parere legale motivato su questioni di diritto civile o commerciale.', oneTimeCost: 600, monthlyCost: 0 },
      { id: 'opt_2', title: 'Assistenza Contrattuale', description: 'Redazione/revisione contratti fino a 10 pagine, inclusa due diligence.', oneTimeCost: 800, monthlyCost: 0 },
      { id: 'opt_3', title: 'Contenzioso Civile', description: 'Assistenza in giudizio, primo grado, inclusi atti e comparizioni.', oneTimeCost: 2000, monthlyCost: 0 },
      { id: 'opt_4', title: 'Consulenza Stragiudiziale', description: 'Supporto mensile per corrispondenza, diffide e mediazione.', oneTimeCost: 0, monthlyCost: 300 },
      { id: 'opt_5', title: 'Assistenza GDPR', description: 'Adeguamento privacy, nomina DPO valutazione d\'impatto e registri.', oneTimeCost: 1200, monthlyCost: 0 },
    ],
    clauses: [
      { id: 'cl_1', title: 'Compensi', body: 'I compensi indicati sono da intendersi oltre CNPA e IVA se dovuta secondo la normativa vigente.' },
    ],
  },
  {
    id: makeId(), title: 'Progetto Architettonico', client: '', status: 'Bozza',
    date: new Date().toISOString().slice(0, 10), owner: '',
    intro: 'Servizi di progettazione architettonica, direzione lavori e pratiche edilizie.',
    color: '#14B8A6', vat: 22, isTemplate: true, isGlobal: true, owner: 'admin@gmail.com',
    options: [
      { id: 'opt_1', title: 'Progetto Preliminare', description: 'Rilievi, schizzi di massima, concept plan e preventivo sommario.', oneTimeCost: 1500, monthlyCost: 0 },
      { id: 'opt_2', title: 'Progetto Definitivo', description: 'Piante, prospetti, sezioni, computo metrico e capitolato lavori.', oneTimeCost: 3500, monthlyCost: 0 },
      { id: 'opt_3', title: 'Direzione Lavori', description: 'Sorveglianza cantiere, contabilità lavori e certificato regolare esecuzione.', oneTimeCost: 2500, monthlyCost: 0 },
      { id: 'opt_4', title: 'Pratiche Edilizie', description: 'SCIA, CILA, permesso di costruire e pratiche comunali complete.', oneTimeCost: 800, monthlyCost: 0 },
      { id: 'opt_5', title: 'Render 3D', description: 'Rendering fotorealistici interni/esterni, 3 viste incluse.', oneTimeCost: 600, monthlyCost: 0 },
    ],
    clauses: [
      { id: 'cl_1', title: 'Tempi', body: 'Le tempistiche sono indicative e possono variare in base ai tempi di risposta della pubblica amministrazione.' },
    ],
  },
  {
    id: makeId(), title: 'Servizio Fotografico', client: '', status: 'Bozza',
    date: new Date().toISOString().slice(0, 10), owner: '',
    intro: 'Preventivo per servizi di fotografia professionale per aziende e privati.',
    color: '#EC4899', vat: 22, isTemplate: true, isGlobal: true, owner: 'admin@gmail.com',
    options: [
      { id: 'opt_1', title: 'Book Ritratti', description: 'Sessione studio 2h, 10 foto ritoccate HD con diritto d\'uso commerciale.', oneTimeCost: 350, monthlyCost: 0 },
      { id: 'opt_2', title: 'Servizio Evento', description: 'Copertura evento fino a 4h, 100+ foto editate in galleria online privata.', oneTimeCost: 600, monthlyCost: 0 },
      { id: 'opt_3', title: 'Fotografia Prodotto', description: 'Shooting prodotto in studio, 20 foto su sfondo bianco con ritocco.', oneTimeCost: 300, monthlyCost: 0 },
      { id: 'opt_4', title: 'Servizio Aziendale', description: 'Giornata intera (8h) per team foto, uffici, ritratti e contenuti social.', oneTimeCost: 1200, monthlyCost: 0 },
      { id: 'opt_5', title: 'Catalogo E-commerce', description: 'Fino a 100 prodotti, 2 scatti cad. con sfondo bianco o contestuale.', oneTimeCost: 1500, monthlyCost: 0 },
    ],
    clauses: [
      { id: 'cl_1', title: 'Diritti', body: 'Le foto vengono concesse con licenza d\'uso illimitata nel tempo e nel mezzo, salvo diversi accordi.' },
      { id: 'cl_2', title: 'Spostamenti', body: 'Per servizi fuori sede oltre 30 km è previsto un rimborso spese di 0.50€/km.' },
    ],
  },
  {
    id: makeId(), title: 'Social Media Management', client: '', status: 'Bozza',
    date: new Date().toISOString().slice(0, 10), owner: '',
    intro: 'Gestione professionale dei tuoi canali social per aumentare engagement e visibilità.',
    color: '#6366F1', vat: 22, isTemplate: true, isGlobal: true, owner: 'admin@gmail.com',
    options: [
      { id: 'opt_1', title: 'Gestione Base', description: '2 canali social, 8 post/mese, community management base e report mensile.', oneTimeCost: 0, monthlyCost: 400 },
      { id: 'opt_2', title: 'Gestione Avanzata', description: '3 canali social, 15 post/mese, stories, adv gestito e report avanzato.', oneTimeCost: 0, monthlyCost: 700 },
      { id: 'opt_3', title: 'Content Strategy', description: 'Piano editoriale trimestrale, calendario contenuti e linee guida visual.', oneTimeCost: 500, monthlyCost: 0 },
      { id: 'opt_4', title: 'Campagna ADV', description: 'Gestione budget pubblicitario, creazione ads, A/B test e report conversioni.', oneTimeCost: 200, monthlyCost: 300 },
      { id: 'opt_5', title: 'Audit Social', description: 'Analisi approfondita canali, competitor benchmark e strategia di miglioramento.', oneTimeCost: 400, monthlyCost: 0 },
    ],
    clauses: [
      { id: 'cl_1', title: 'Durata', body: 'Il contratto ha durata minima trimestrale. Disdetta con preavviso di 30 giorni.' },
    ],
  },
  {
    id: makeId(), title: 'Produzione Video', client: '', status: 'Bozza',
    date: new Date().toISOString().slice(0, 10), owner: '',
    intro: 'Realizzazione di contenuti video professionali dal concept alla post-produzione.',
    color: '#84CC16', vat: 22, isTemplate: true, isGlobal: true, owner: 'admin@gmail.com',
    options: [
      { id: 'opt_1', title: 'Video Aziendale', description: 'Video 60-90s, soggetto e sceneggiatura, riprese 4h, montaggio e color correction.', oneTimeCost: 1200, monthlyCost: 0 },
      { id: 'opt_2', title: 'Intervista/Testimonial', description: 'Intervista professionale, 2 camere, set luce, montaggio e sottotitoli.', oneTimeCost: 800, monthlyCost: 0 },
      { id: 'opt_3', title: 'Video Social', description: 'Video verticale/quadrato 30-60s per social, inclusi motion graphics base.', oneTimeCost: 350, monthlyCost: 0 },
      { id: 'opt_4', title: 'Copertura Evento', description: 'Ripresa evento fino a 6h, montaggio reel 3min e highlight 30s per social.', oneTimeCost: 1500, monthlyCost: 0 },
      { id: 'opt_5', title: 'Riprese Droni', description: 'Riprese aeree con drone professionista, fino a 2h di volo, footage editato.', oneTimeCost: 500, monthlyCost: 0 },
    ],
    clauses: [
      { id: 'cl_1', title: 'Revisioni', body: 'Sono incluse 2 revisioni. Il materiale grezzo non viene ceduto salvo accordi separati.' },
    ],
  },
  {
    id: makeId(), title: 'Consulenza SEO', client: '', status: 'Bozza',
    date: new Date().toISOString().slice(0, 10), owner: '',
    intro: 'Servizi di ottimizzazione per motori di ricerca: visibilità, traffico e conversioni organiche.',
    color: '#84CC16', vat: 22, isTemplate: true, isGlobal: true, owner: 'admin@gmail.com',
    options: [
      { id: 'opt_1', title: 'SEO Audit', description: 'Analisi tecnica, competitor, parole chiave, backlink e report con raccomandazioni.', oneTimeCost: 500, monthlyCost: 0 },
      { id: 'opt_2', title: 'SEO On-page', description: 'Ottimizzazione contenuti, meta tag, heading, struttura URL e internal linking.', oneTimeCost: 0, monthlyCost: 300 },
      { id: 'opt_3', title: 'Link Building', description: 'Acquisizione backlink qualificati, outreach strategico e monitoraggio profilo.', oneTimeCost: 200, monthlyCost: 400 },
      { id: 'opt_4', title: 'SEO Tecnico', description: 'Velocità sito, core web vitals, dati strutturati, sitemap e robots.txt.', oneTimeCost: 400, monthlyCost: 0 },
      { id: 'opt_5', title: 'Content SEO', description: 'Redazione ottimizzata articoli/blog, 4 articoli/mese con ricerca keyword.', oneTimeCost: 0, monthlyCost: 500 },
    ],
    clauses: [
      { id: 'cl_1', title: 'Tempistiche', body: 'I risultati SEO richiedono tempi tecnici: i primi miglioramenti sono visibili in 3-6 mesi.' },
    ],
  },
];
