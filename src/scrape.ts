const puppeteer = require("puppeteer");
import type { Page, ElementHandle, Browser } from "puppeteer";

export interface Ad {
  usernameAndRating: string;
  descripcionYBanco: string;
  precioBtc: number;
  limiteInferior: number;
  limiteSuperior: number;
  adUrl: string;
}

const lbcUrl = "https://www.localbitcoins.com/";
const comprarUrl = "https://localbitcoins.com/buy-bitcoins-online/ves/";
const venderUrl = "https://localbitcoins.com/sell-bitcoins-online/ves/";

const blockPageResources = async (page: Page) => {
  await page.setRequestInterception(true);
  page.on("request", request => {
    if (["image", "stylesheet", "font", "script"].indexOf(request.resourceType()) !== -1) {
      request.abort();
    } else {
      request.continue();
    }
  });
};

const scrapePage = async (adRows: ElementHandle<Element>[]) => {
  const pageAds: Ad[] = [];

  for (const adRow of adRows) {
    let usernameAndRating = "ERROR_USERNAME_AND_RATING";
    const nombreAnchor = await adRow.$(".column-user > a");
    if (nombreAnchor) usernameAndRating = await nombreAnchor.evaluate(anchor => anchor.innerHTML);

    let descripcionYBanco = "ERROR_DESCRIPCION_Y_BANCO";
    const descripcionTd = await adRow.$("td:nth-child(2)");
    if (descripcionTd) descripcionYBanco = await descripcionTd.evaluate(td => (td as HTMLElement).innerText);

    let precioBtc = -999999999999999;
    const precioPorBtcTd = await adRow.$(".column-price");
    if (precioPorBtcTd) {
      const precioRaw = await precioPorBtcTd.evaluate(td => (td as HTMLElement).innerText);
      precioBtc = Number(precioRaw.replace(" VES", "").replace(/,/g, ""));
    }

    let limiteInferior = -999999999999999;
    let limiteSuperior = -999999999999999;
    const limitesTd = await adRow.$(".column-limit");
    const limitsRaw = await limitesTd?.evaluate(td => (td as HTMLElement).innerText);
    if (limitsRaw) {
      limiteInferior = Number(limitsRaw.slice(0, limitsRaw.indexOf(" ")).replace(/,/g, ""));
      limiteSuperior = Number(limitsRaw.slice(limitsRaw.indexOf(" ") + 3, -4).replace(/,/g, ""));
    }

    let adUrl = "ERROR_AD_URL";
    const adAnchor = await adRow.$(".column-button > a");
    if (adAnchor) adUrl = lbcUrl + (await adAnchor.evaluate(a => a.getAttribute("href")));

    const ad = { usernameAndRating, descripcionYBanco, precioBtc, limiteInferior, limiteSuperior, adUrl };
    pageAds.push(ad);
  }

  return pageAds;
};

const listarAds = async (page: Page, url: typeof comprarUrl | typeof venderUrl) => {
  await page.goto(url);
  const cantidadDePaginas = ((await page.$$(".page-item")).length - 4) / 2;

  const adRows = await page.$$(".clickable");

  let allAds: Ad[] = [];
  allAds.push(...(await scrapePage(adRows)));

  for (let pagina = 2; pagina <= cantidadDePaginas; pagina++) {
    await page.goto(url + `?page=${pagina}`);
    const adRows = await page.$$(".clickable");

    allAds.push(...(await scrapePage(adRows)));
  }

  return allAds;
};

export const fetchCompraVentaAds = async () => {
  // const browser = (await puppeteer.connect({ browserURL: "http://127.0.0.1:9222" })) as Browser;
  const startTime = Date.now();
  const browser = (await puppeteer.launch({ headless: false })) as Browser;
  const page = await browser.newPage();
  await blockPageResources(page);

  const ventaAds = await listarAds(page, venderUrl);
  const compraAds = await listarAds(page, comprarUrl);

  browser.close();

  console.log((Date.now() - startTime) / 1000);

  return { ventaAds, compraAds };
};
