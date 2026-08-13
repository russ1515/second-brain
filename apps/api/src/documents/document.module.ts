import { Module } from '@nestjs/common';
import { ConceptModule } from '../concepts/concept.module';
import { FlashcardsModule } from '../flashcards/flashcards.module';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { ScanService } from './scan.service';
import { TextExtractionService } from './extraction/text-extraction.service';
import { ChunkingService } from './ingestion/chunking.service';
import { CleaningService } from './ingestion/cleaning.service';
import { IngestionService } from './ingestion/ingestion.service';
import { RetrievalService } from './retrieval/retrieval.service';
import { RagService } from './rag/rag.service';
import { DocumentEnrichmentService } from './enrichment/document-enrichment.service';
import { LibraryService } from './library/library.service';
import { LibraryController } from './library/library.controller';
import { DocumentUnderstandingService } from './understanding/document-understanding.service';
import { UnderstandingController } from './understanding/understanding.controller';
import { StudyResourceService } from './resources/study-resource.service';
import { StudyResourceController } from './resources/study-resource.controller';
import { WorkspaceService } from './workspace/workspace.service';
import { WorkspaceController } from './workspace/workspace.controller';
import { KnowledgeIntegrationService } from './integration/knowledge-integration.service';
import { KnowledgeIntegrationController } from './integration/knowledge-integration.controller';

/** Learning Memory Engine — document ingestion & the Smart Upload Pipeline
 *  (Phase 2 + Sprint 6.2) plus the Smart Library organization surface (6.1).
 *  Imports ConceptModule so the pipeline can build the Knowledge Graph. */
@Module({
  imports: [ConceptModule, FlashcardsModule],
  controllers: [
    DocumentController,
    LibraryController,
    UnderstandingController,
    StudyResourceController,
    WorkspaceController,
    KnowledgeIntegrationController,
  ],
  providers: [
    DocumentService,
    ScanService,
    TextExtractionService,
    ChunkingService,
    CleaningService,
    IngestionService,
    RetrievalService,
    RagService,
    DocumentEnrichmentService,
    LibraryService,
    DocumentUnderstandingService,
    StudyResourceService,
    WorkspaceService,
    KnowledgeIntegrationService,
  ],
  exports: [DocumentService, RetrievalService],
})
export class DocumentModule {}
