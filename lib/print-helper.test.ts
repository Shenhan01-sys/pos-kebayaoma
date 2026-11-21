import { describe, expect, it } from "vitest";
import { HELPER_SETTINGS_URL, helperIntentUrl } from "./print-helper";

describe("helperIntentUrl", () => {
  it("target + base64 di data URI, paket dikunci ke app pembantu", () => {
    expect(helperIntentUrl("nota", "QUJD")).toBe(
      "intent:nota;base64,QUJD#Intent;scheme=kopos-print;package=id.kebayaoma.print;end;"
    );
    expect(helperIntentUrl("label", "eA==")).toContain("intent:label;base64,eA==#Intent;scheme=kopos-print;");
  });
  it("URL setelan membuka app pembantu", () => {
    expect(HELPER_SETTINGS_URL).toBe("intent:settings#Intent;scheme=kopos-print;package=id.kebayaoma.print;end;");
  });
});
