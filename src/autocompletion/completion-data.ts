import * as fs from 'fs';
import * as path from 'path';

export interface ProviderInfo {
  provider_arguments: any[];
  resources: { [name: string]: SectionInfo };
  datas: { [name: string]: SectionInfo }
}

export interface SectionInfo {
  arguments: SubblockInfo[] | ArgumentInfo[];
  attributes: AttributeInfo[];
}

export interface ArgumentInfo {
  word: string;
  type: "bool" | "float" | "int" | "list" | "map" | "set" | "string";
  required: boolean;
  block: false;
}

export interface SubblockInfo {
  word: string;
  type: "bool" | "float" | "int" | "list" | "map" | "set" | "string";
  required: boolean;
  block: true;
  subblock: SubblockInfo[] | ArgumentInfo[];
}

export interface AttributeInfo {
  word: string;
  type: "bool" | "float" | "int" | "list" | "map" | "set" | "string";
  block: false;
}

interface RawCompletionIndex {
  providers: { [name: string]: ProviderIndex };
  views: Views;
}

export interface ProviderIndex {
  versions: { [version: string]: VersionOverview };
  meta: ProviderMetadata;
  latest: string;
}

export interface VersionOverview {
  path: string;
  resources: string[];
  datas: string[];
  unknowns: string[];
}

export interface ProviderMetadata {
  type: "provider" | "community_provider";
}

export interface Views {
  all: {
    resources: string[];
    datas: string[];
    unknowns: string[];
  }
}

function loadJsonAs<T>(jsonPath: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    fs.readFile(jsonPath, (err, data) => {
      if (err) {
        reject(new Error(`Could not load data from ${jsonPath}: ${err}`));
      } else {
        const json = JSON.parse(data.toString());
        resolve(json as T);
      }
    });
  });
}

export const defaultBasePath = (() => {
  try {
    require('vscode');

    // running integration tests
    return path.join(__dirname, '../data/');
  } catch (e) {

    // running unit tests
    return path.join(__dirname, '../../out/src/data');
  }
})();

export class CompletionIndex {
  private knownProviders: string[];

  private constructor(private data: RawCompletionIndex) {
    this.knownProviders = Object.keys(this.data.providers);
  }

  static async create(indexPath: string): Promise<CompletionIndex> {
    return new CompletionIndex(await loadJsonAs<RawCompletionIndex>(indexPath));
  }

  get providers() {
    return this.knownProviders;
  }

  provider(name: string): ProviderIndex {
    return this.data.providers[name];
  }

  all(type: "resource" | "data", prefix?: string): string[] {
    const all = type === "resource" ? this.data.views.all.resources : this.data.views.all.datas;

    if (!prefix)
      return all;

    return all.filter((i) => i.startsWith(prefix));
  }

  realVersion(provider: string, version: string = "LATEST"): string {
    if (version !== "LATEST")
      return version;

    const p = this.provider(provider);
    if (!p) {
      throw new Error(`Unknown provider ${provider}`);
    }

    return p.latest;
  }
}

export class CompletionData {
  private _loadedData = new Map<string, Map<string, ProviderInfo>>();

  private constructor(private _basePath: string, private _index: CompletionIndex) {}

  static async create(basePath: string): Promise<CompletionData> {
    const indexPath = path.join(basePath, "provider-index.json");
    return new CompletionData(basePath, await CompletionIndex.create(indexPath));
  }

  get index(): CompletionIndex {
    return this._index;
  }

  get loadedProviders(): string[] {
    return [...this._loadedData.keys()];
  }

  async load(provider: string, version: string = "LATEST"): Promise<ProviderInfo> {
    const realVersion = this.index.realVersion(provider, version);

    const providerIndexData = this.index.provider(provider);
    if (!providerIndexData) {
      throw new Error(`Unknown provider ${provider}`);
    }

    const providerVersionInfoData = providerIndexData.versions[realVersion];
    if (!providerVersionInfoData) {
      throw new Error(`Unknown provider version ${realVersion} (requested: ${version}) of provider ${provider}`);
    }

    let providerData = this._loadedData.get(provider);
    if (!providerData) {
      providerData = new Map<string, ProviderInfo>();
      this._loadedData.set(provider, providerData);
    }

    let providerInfo = providerData.get(realVersion);
    if (!providerInfo) {
      const dataPath = path.join(this._basePath, "providers", providerVersionInfoData.path);
      providerInfo = await loadJsonAs<ProviderInfo>(dataPath);
      providerData.set(realVersion, providerInfo);
    }

    return providerInfo;
  }
}