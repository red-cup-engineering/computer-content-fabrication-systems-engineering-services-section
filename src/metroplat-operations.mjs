/**
 * The MetroPlat declarations, bound to `@red-cup-engineering/relating` (an optional peer: a host that
 * declares operations has it). Import this module only where it is installed.
 */
import { schemaFrom } from "@red-cup-engineering/json-schema-engineering-services-section/contracts";
import { operationDeclaration } from "@red-cup-engineering/relating/operation-declaration";
import { declareOperations } from "./declare.mjs";

export const declarations = declareOperations({ operationDeclaration, schemaFrom });

export const admitFabricationOrderDeclaration = declarations["admit-fabrication-order"];
export const quoteFabricationOrderDeclaration = declarations["quote-fabrication-order"];
export const planFabricationDeclaration = declarations["plan-fabrication"];
export const assayFabricatedArtifactDeclaration = declarations["assay-fabricated-artifact"];
export const receiveFabricationDeliveryDeclaration = declarations["receive-fabrication-delivery"];
export const orderResearchPaperDeclaration = declarations["order-research-paper"];
export const orderResearchPaperTextDeclaration = declarations["order-research-paper-text"];
export const orderCorpusResearchPaperDeclaration = declarations["order-corpus-research-paper"];
export const orderLeanProofRoutineDeclaration = declarations["order-lean-proof-routine"];
export const orderLeanProofStandardDeclaration = declarations["order-lean-proof-standard"];
export const orderLeanProofAdvancedDeclaration = declarations["order-lean-proof-advanced"];
export const orderSvgChartDeclaration = declarations["order-svg-chart"];
export const orderSvgDiagramDeclaration = declarations["order-svg-diagram"];
export const orderEbookDeclaration = declarations["order-ebook"];
export const orderNewsletterIssueDeclaration = declarations["order-newsletter-issue"];
export const orderFictionSerialDeclaration = declarations["order-fiction-serial"];
