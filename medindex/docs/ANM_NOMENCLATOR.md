# ANM nomenclator (nomenclator.anm.ro)

Human-use medicines are listed at:

`https://nomenclator.anm.ro/medicamente?page={n}`

## Row fields (HTML)

Each product row exposes a **Detalii** `<button>` with `data-*` attributes (no separate detail request needed for the list sync):

| Attribute | Meaning |
|-----------|---------|
| `data-cim` | Cod CIM (stable product id) |
| `data-dencom` | Denumire comercială |
| `data-dci` | DCI (INN) |
| `data-formafarm` | Formă farmaceutică |
| `data-conc` | Concentrație |
| `data-codatc` | Cod ATC |
| `data-actter` | Acțiune terapeutică |
| `data-prescript` | Prescripție (e.g. PR) |
| `data-ambalaj` | Ambalaj |
| `data-volumamb` | Volum ambalaj |
| `data-valabamb` | Valabilitate ambalaj |
| `data-firmtarp` | Firmă / țară producător |
| `data-firmtard` | Firmă / țară deținător APP |
| `data-nrdtamb` | Număr înregistrare |
| `data-linkrcp` | URL PDF RCP (ANM) |
| `data-linkpro` | URL PDF prospect |
| `data-linkamb` | URL PDF ambalaj |
| `data-tipinreg` | Tip înregistrare |

## Excel

Bulk export: `https://nomenclator.anm.ro/files/nomenclator.xlsx` (linked from the list UI).

## MedIndex ingest

Implemented in [`lib/ingest/anm.ts`](lib/ingest/anm.ts) (HTML fetch + Cheerio) and orchestrated from [`lib/ingest/sync.ts`](lib/ingest/sync.ts). Respect ANM rate limits and terms of use in production.
