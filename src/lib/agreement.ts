import lines from "./owner-agreement.json";

export interface AgreementParty { name?: string; idno?: string; addr?: string; phone?: string }

// ממלא את הקווים הריקים בטיוטת ההסכם: המופע הראשון של כל שדה הוא בעל הנכס, השני החברה.
function fill(line: string, value?: string) {
  const m = /^([^:_]+:)\s*_+.*$/.exec(line);
  return m && value ? `${m[1]} ${value}` : line;
}

export function buildAgreement(owner: AgreementParty, company: AgreementParty, dateText: string): string[] {
  const seen = { name: 0, id: 0, addr: 0, phone: 0 };
  return (lines as string[]).map((l) => {
    if (/^שנערך ונחתם/.test(l)) return `שנערך ונחתם ביום ${dateText}`;
    if (/^שם \/ חברה:/.test(l)) return fill(l, ++seen.name === 1 ? owner.name : company.name);
    if (/^ח\.פ\. \/ ת\.ז\.:/.test(l)) return fill(l, ++seen.id === 1 ? owner.idno : company.idno);
    if (/^כתובת:/.test(l)) return fill(l, ++seen.addr === 1 ? owner.addr : company.addr);
    if (/^טלפון:/.test(l)) return fill(l, ++seen.phone === 1 ? owner.phone : company.phone);
    return l;
  });
}
