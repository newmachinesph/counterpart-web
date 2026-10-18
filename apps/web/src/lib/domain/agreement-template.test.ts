import { describe, expect, it } from "vitest";
import { AGREEMENT_FIELDS, agreementText, fillAgreement, templateVariables } from "./agreement-template";

// Templates come from the API; these assertions cover the renderer's contract.
const AGREEMENT_TEMPLATE = { id: "test", title: "Commercial agreement", reviewNote: "Draft review notice", sections: [{heading: "Paid trial", body: "[BUILDER_NAME]: trial lasts [TRIAL_DAYS] days; fee PHP [MONTHLY_FEE_PHP]."}] };
describe("agreement draft", () => {
  it("provides one editable field for every template variable", () => {
    const keys = AGREEMENT_FIELDS.map((field) => field.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of templateVariables(AGREEMENT_TEMPLATE)) expect(keys).toContain(key);
  });

  it("replaces repeated variables literally and preserves unfilled placeholders", () => {
    expect(fillAgreement("[NAME] / [NAME] / [EMPTY] / [MISSING]", { NAME: "$& <script> [OTHER]", EMPTY: "  " }))
      .toBe("$& <script> [OTHER] / $& <script> [OTHER] / [EMPTY] / [MISSING]");
  });

  it("exports current values, all sections, and the draft review notice", () => {
    const text = agreementText(AGREEMENT_TEMPLATE, { TRIAL_DAYS: "60", MONTHLY_FEE_PHP: "15000" });
    expect(text).toContain("lasts 60 days");
    expect(text).toContain("fee PHP 15000");
    expect(text).toContain(AGREEMENT_TEMPLATE.reviewNote);
    for (const section of AGREEMENT_TEMPLATE.sections) expect(text).toContain(section.heading);
    expect(text).toContain("[BUILDER_NAME]");
  });
});
