import * as assert from "assert";
import * as path from "path";
import { CompletionData, CompletionIndex, defaultBasePath } from "../../src/autocompletion/completion-data";

suite("Autocompletion Data", () => {
  suite("CompletionIndex", () => {
    test("create", async () => {
      let index = await CompletionIndex.create(path.join(defaultBasePath, "provider-index.json"));

      assert(index);
      assert(index.providers.length > 100, `Not enough providers load from index. It should be around >120, but only ${index.providers.length} found.`);
    });

    test("ensure common providers exist", async () => {
      let index = await CompletionIndex.create(path.join(defaultBasePath, "provider-index.json"));

      for (const name of ['aws', 'azurerm', 'google']) {
        assert(index.provider("aws"), `could not find common provider: ${name}`);
      }
    });

    test("all can return all resources", async () => {
      let index = await CompletionIndex.create(path.join(defaultBasePath, "provider-index.json"));

      let resources = index.all("resource");
      assert(resources.length > 200);
    });

    test("all can return all datas", async () => {
      let index = await CompletionIndex.create(path.join(defaultBasePath, "provider-index.json"));

      let datas = index.all("data");
      assert(datas.length > 200);
    });

    test("all filters by prefix", async () => {
      let index = await CompletionIndex.create(path.join(defaultBasePath, "provider-index.json"));

      let resources = index.all("resource", "azurerm");
      for (const resource of resources) {
        assert(resource.startsWith("azurerm"), `${resource} was expected to start with 'azurerm'`);
      }

      let datas = index.all("data", "azurerm");
      for (const data of datas) {
        assert(data.startsWith("azurerm"), `${data} was expected to start with 'azurerm'`);
      }
    });
  });

  suite("CompletionData", () => {
    test("create", async () => {
      let cd = await CompletionData.create(defaultBasePath);

      assert(cd);
      assert(cd.index);
      assert.equal(cd.loadedProviders.length, 0);
    });

    test("load returns a provider", async () => {
      let cd = await CompletionData.create(defaultBasePath);

      let pi = await cd.load("aws");
      assert(pi);
      assert.equal(cd.loadedProviders.length, 1);
    });

    test("load returns latest version by default", async () => {
      let cd = await CompletionData.create(defaultBasePath);

      let pi1 = await cd.load("aws");
      let pi2 = await cd.load("aws", "LATEST");
      assert.deepEqual(pi1, pi2);
    });

    test("load returns a specific provider version if requested", async () => {
      let cd = await CompletionData.create(defaultBasePath);

      let pi1 = await cd.load("aws", "1.25.0");
      let pi2 = await cd.load("aws", "LATEST");
      assert.notDeepEqual(pi1, pi2);
    });
  });
});