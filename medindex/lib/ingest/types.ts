/**
 * Parsed row from ANM nomenclator list HTML (`/medicamente?page=n`).
 * Source: `button[data-cim]` attributes on https://nomenclator.anm.ro/medicamente
 */
export type AnmMedicineRow = {
  cim: string;
  denComerciala: string;
  dci: string;
  formaFarmaceutica: string;
  concentratie: string;
  codAtc: string;
  actTerapeutic: string;
  prescriptie: string;
  ambalaj: string;
  volumAmbalaj: string;
  valabilitateAmbalaj: string;
  firmaTaraProducator: string;
  firmaTaraDetinator: string;
  numarInregistrare: string;
  linkRcp: string;
  linkProspect: string;
  linkAmbalaj: string;
  tipInregistrare: string;
};

export const ANM_BASE = "https://nomenclator.anm.ro";
