Stratégie d'ingestion et de chunking pour la base documentaire MREITI
Analyse des documents fournis
Document 1: Note d'orientation ITIE 1.4 (Groupes multipartites)
Caractéristiques:

Structure hiérarchique avec sections numérotées (Étapes 1-5)
Tableaux de synthèse et exemples
Études de cas encadrées
Références croisées entre sections
Métadonnées: titre, date, requirement ITIE

Document 2: Note d'orientation ITIE 4.1 (Matérialité)
Caractéristiques:

Structure par étapes méthodologiques
Diagrammes de flux (figures)
Exemples pays concrets (Tanzanie, Cameroun)
Tableaux de données chiffrées
Formules et calculs

Problématiques identifiées

Perte de contexte hiérarchique: Les chunks isolés perdent leur position dans la structure
Séparation des exemples: Les études de cas sont coupées de leur contexte théorique
Tableaux fragmentés: Les données tabulaires perdent leur sens si divisées
Références brisées: Les renvois à d'autres sections deviennent incompréhensibles

Solution proposée: Chunking hybride avec métadonnées enrichies
Stratégie de chunking
pythonCHUNKING_STRATEGY = {
    "method": "hybrid",
    "base_chunk_size": 800,  # tokens
    "overlap": 150,  # tokens
    "respect_boundaries": [
        "sections",
        "subsections", 
        "examples",
        "tables"
    ]
}
Architecture d'ingestion recommandée
1. Extraction et prétraitement
pythondef extract_document_structure(pdf_path):
    """
    Extrait la structure hiérarchique du document
    """
    return {
        "metadata": {
            "title": "Établissement et gouvernance des GM",
            "document_type": "note_orientation",
            "requirement": "1.4",
            "date": "2022-02",
            "language": "fr"
        },
        "sections": [
            {
                "id": "etape_1",
                "title": "Action de sensibilisation",
                "level": 1,
                "parent": "root",
                "content": "...",
                "examples": [...],
                "tables": [...]
            }
        ]
    }
2. Chunking intelligent par type de contenu
Type A: Sections narratives
python{
    "chunk_type": "narrative_section",
    "content": "Le groupe multipartite doit...",
    "metadata": {
        "section_path": "Étape 2 > Nomination des membres",
        "requirement": "1.4.a.ii",
        "parent_section": "Comment mettre en œuvre l'Exigence 1.4",
        "keywords": ["nomination", "représentation", "diversité"]
    }
}
Type B: Exemples et études de cas
python{
    "chunk_type": "case_study",
    "content": "Guinée: En 2021, le collège...",
    "metadata": {
        "country": "Guinée",
        "topic": "diversité genre",
        "related_section": "Étape 2",
        "requirement": "1.4.a.ii"
    },
    "context": "Diversité et inclusion au sein des groupes multipartites"
}
Type C: Tableaux et données
python{
    "chunk_type": "data_table",
    "content": "[Tableau complet avec en-têtes]",
    "metadata": {
        "table_title": "Options pour les seuils de paiements agrégés",
        "data_type": "seuils_matérialité",
        "country": "Zambie",
        "related_requirement": "4.1"
    },
    "structured_data": {
        "headers": ["Seuil", "Nombre d'entreprises", "Revenus"],
        "rows": [...]
    }
}
3. Stratégie d'embedding multi-niveaux
pythonEMBEDDING_STRATEGY = {
    "primary": {
        "model": "nomic-embed-text",
        "content": "chunk_content + context_summary"
    },
    "metadata_enrichment": [
        "section_hierarchy",
        "document_type",
        "requirement_number",
        "keywords_extracted"
    ]
}
Métadonnées enrichies pour Qdrant
pythonmetadata_schema = {
    # Identification
    "doc_id": "ITIE_GN_1_4_0",
    "chunk_id": "chunk_0042",
    "chunk_type": "narrative_section|case_study|data_table|definition",
    
    # Hiérarchie
    "section_level_1": "Comment mettre en œuvre l'Exigence 1.4",
    "section_level_2": "Étape 2: Nomination des membres",
    "section_level_3": "Représentation des genres",
    
    # Contexte ITIE
    "requirement": "1.4.a.ii",
    "topic": ["nomination", "diversité", "genre"],
    "document_type": "note_orientation",
    
    # Géographie
    "countries_mentioned": ["Guinée", "Nigeria", "Ghana"],
    
    # Contenu structuré
    "has_table": True,
    "has_diagram": False,
    "has_formula": False,
    
    # Relations
    "related_chunks": ["chunk_0041", "chunk_0043"],
    "related_requirements": ["1.4.a", "1.4.b.vi"],
    
    # Enrichissement sémantique
    "keywords": ["groupe multipartite", "nomination", "équilibre genre"],
    "entities": ["Groupe multipartite", "collège", "société civile"]
}
Pipeline d'ingestion complet
python# 1. Extraction
documents = load_pdfs_with_structure("/mnt/user-data/uploads/")

# 2. Chunking intelligent
chunks = []
for doc in documents:
    # Sections narratives (800 tokens, overlap 150)
    narrative_chunks = chunk_narrative_sections(
        doc.sections, 
        max_tokens=800,
        overlap=150,
        preserve_hierarchy=True
    )
    
    # Exemples/cas pratiques (garder intacts si < 1200 tokens)
    case_chunks = extract_case_studies(
        doc.sections,
        max_tokens=1200,
        include_context=True
    )
    
    # Tableaux (toujours garder complets)
    table_chunks = extract_tables(
        doc.sections,
        include_caption=True,
        add_interpretation=True
    )
    
    chunks.extend(narrative_chunks + case_chunks + table_chunks)

# 3. Enrichissement des métadonnées
for chunk in chunks:
    chunk.metadata.update({
        "section_path": get_full_section_path(chunk),
        "context_summary": generate_context_summary(chunk),
        "keywords": extract_keywords(chunk.content),
        "entities": extract_entities(chunk.content)
    })

# 4. Embedding
embeddings = embed_with_context(
    chunks,
    model="nomic-embed-text",
    add_context_prefix=True  # "Document ITIE 1.4, Étape 2: [content]"
)

# 5. Indexation Qdrant
index_to_qdrant(
    chunks,
    embeddings,
    collection_name="mreiti_docs_v2",
    vector_size=768,
    metadata_schema=metadata_schema
)
Stratégie de retrieval optimisée
1. Requête utilisateur avec expansion contextuelle
pythondef expand_user_query(query: str) -> dict:
    """
    Enrichit la requête utilisateur avec contexte ITIE
    """
    return {
        "original": "Comment former un groupe multipartite?",
        "expanded": "établissement composition nomination membres groupe multipartite ITIE",
        "filters": {
            "requirement_prefix": "1.4",
            "chunk_type": ["narrative_section", "case_study"],
            "exclude_types": ["data_table"]  # si pas de données chiffrées demandées
        }
    }
2. Recherche hybride
pythondef hybrid_search(query: str, top_k: int = 10):
    # Recherche vectorielle dense
    dense_results = qdrant_client.search(
        collection_name="mreiti_docs_v2",
        query_vector=embed_query(query),
        limit=top_k * 2,
        query_filter=build_filters(query)
    )
    
    # Recherche par mots-clés (BM25)
    sparse_results = qdrant_client.search(
        collection_name="mreiti_docs_v2",
        query_vector=create_sparse_vector(query),
        using="sparse",
        limit=top_k * 2
    )
    
    # Fusion RRF (Reciprocal Rank Fusion)
    combined = rrf_fusion(dense_results, sparse_results, k=60)
    
    return combined[:top_k]
3. Reranking contextuel
pythondef rerank_with_context(results: list, query: str):
    """
    Rerank en tenant compte de la cohérence hiérarchique
    """
    scored_results = []
    for result in results:
        score = result.score
        
        # Bonus si chunk contient exemple concret
        if result.metadata["chunk_type"] == "case_study":
            score *= 1.2
        
        # Bonus si chunk de section parent présent dans résultats
        if has_parent_chunk_in_results(result, results):
            score *= 1.15
        
        # Bonus si requirement exact match
        if query_mentions_requirement(query, result.metadata["requirement"]):
            score *= 1.3
        
        scored_results.append((result, score))
    
    return sorted(scored_results, key=lambda x: x[1], reverse=True)
4. Reconstruction du contexte pour la génération
pythondef build_context_for_llm(top_chunks: list) -> str:
    """
    Reconstruit un contexte cohérent pour le LLM
    """
    context_parts = []
    
    for chunk in top_chunks:
        # Ajouter le chemin hiérarchique
        section_path = " > ".join([
            chunk.metadata.get("section_level_1", ""),
            chunk.metadata.get("section_level_2", ""),
            chunk.metadata.get("section_level_3", "")
        ])
        
        context_block = f"""
[{chunk.metadata['document_type'].upper()} - {chunk.metadata['requirement']}]
{section_path}

{chunk.content}
"""
        
        # Ajouter exemples liés si pertinent
        if chunk.metadata.get("has_examples"):
            examples = fetch_related_examples(chunk.chunk_id)
            context_block += f"\n\nExemples:\n{examples}"
        
        context_parts.append(context_block)
    
    return "\n\n---\n\n".join(context_parts)
Recommandations spécifiques pour vos 40+ documents
1. Typologie des documents
Catégorisez vos documents selon:

Notes d'orientation (comme les exemples fournis)
Rapports ITIE (données pays)
Documents de référence (Norme ITIE)
Guides pratiques

2. Chunking adapté par type
Type documentTaille chunkOverlapRègles spécialesNotes orientation800 tokens150Préserver hiérarchie sectionsRapports ITIE1000 tokens200Garder tableaux completsNorme ITIE600 tokens100Lier requirements connexesGuides pratiques700 tokens150Grouper étapes procédurales
3. Schéma de métadonnées unifié
pythonUNIVERSAL_METADATA = {
    # Toujours présent
    "doc_id": str,
    "chunk_id": str,
    "doc_type": str,  # "note_orientation|rapport|norme|guide"
    "language": str,
    
    # Spécifique ITIE
    "requirement": Optional[str],  # "1.4.a.ii"
    "pillar": Optional[str],  # "governance|transparency|accountability"
    
    # Géographie
    "country": Optional[str],
    "region": Optional[str],
    
    # Structure
    "section_hierarchy": list[str],
    "chunk_type": str,
    
    # Contenu
    "has_table": bool,
    "has_diagram": bool,
    "has_formula": bool,
    "has_example": bool,
    
    # Sémantique
    "keywords": list[str],
    "topics": list[str],
    "entities": list[str]
}
4. Tests de validation
pythondef validate_chunking_quality():
    """
    Tests à effectuer après ingestion
    """
    tests = [
        # 1. Couverture
        "check_all_sections_indexed()",
        
        # 2. Cohérence
        "verify_no_orphaned_examples()",
        
        # 3. Intégrité tableaux
        "validate_tables_complete()",
        
        # 4. Qualité retrieval
        "test_sample_queries([
            'Comment former un GM?',
            'Seuils de matérialité Tanzanie',
            'Exigence 4.1 entreprises d\'État'
        ])",
        
        # 5. Absence de doublons
        "check_duplicate_chunks(similarity_threshold=0.95)"
    ]
```

## Implémentation dans n8n

### Workflow recommandé
```
1. [Webhook] Déclencheur upload fichier
    ↓
2. [Python] Extraction structure PDF
    ↓
3. [Switch] Router par type de document
    ↓
4a. [Python] Chunking Notes orientation
4b. [Python] Chunking Rapports
4c. [Python] Chunking Normes
    ↓
5. [Python] Enrichissement métadonnées
    ↓
6. [Ollama] Embedding (nomic-embed-text)
    ↓
7. [Qdrant] Indexation avec métadonnées
    ↓
8. [Python] Tests de validation
    ↓
9. [Webhook] Retour statut
Nœud Python pour chunking intelligent
python# Dans n8n Python node
import json
from typing import List, Dict

def intelligent_chunking(pdf_content: str, doc_metadata: dict) -> List[dict]:
    """
    Chunking adaptatif selon type de document
    """
    doc_type = doc_metadata.get("doc_type")
    
    if doc_type == "note_orientation":
        return chunk_guidance_note(pdf_content, max_tokens=800, overlap=150)
    elif doc_type == "rapport":
        return chunk_report(pdf_content, max_tokens=1000, overlap=200)
    elif doc_type == "norme":
        return chunk_standard(pdf_content, max_tokens=600, overlap=100)
    else:
        return chunk_default(pdf_content, max_tokens=700, overlap=150)

def chunk_guidance_note(content: str, max_tokens: int, overlap: int) -> List[dict]:
    """
    Chunking spécifique pour notes d'orientation
    """
    chunks = []
    sections = extract_sections(content)  # Détecte "Étape 1", "Étape 2", etc.
    
    for section in sections:
        # Préserver intégrité section si < max_tokens * 1.5
        if count_tokens(section.content) < max_tokens * 1.5:
            chunks.append({
                "content": section.content,
                "metadata": {
                    "section_title": section.title,
                    "section_level": section.level,
                    "chunk_type": "complete_section"
                }
            })
        else:
            # Subdiviser en respectant paragraphes
            sub_chunks = split_preserving_paragraphs(
                section.content, 
                max_tokens, 
                overlap
            )
            chunks.extend(sub_chunks)
    
    return chunks
Monitoring et amélioration continue
Métriques à suivre
pythonQUALITY_METRICS = {
    "retrieval_metrics": {
        "precision@5": 0.0,  # Target: > 0.8
        "recall@10": 0.0,    # Target: > 0.7
        "mrr": 0.0           # Mean Reciprocal Rank, Target: > 0.75
    },
    
    "chunking_metrics": {
        "avg_chunk_size": 0,       # Target: 600-900 tokens
        "chunks_with_context": 0,   # Target: 100%
        "orphaned_examples": 0,     # Target: 0
        "fragmented_tables": 0      # Target: 0
    },
    
    "user_satisfaction": {
        "thumbs_up_ratio": 0.0,    # Target: > 0.75
        "avg_response_quality": 0.0  # 1-5 scale, Target: > 4.0
    }
}
Tests de requêtes de référence
pythonBENCHMARK_QUERIES = [
    {
        "query": "Comment établir un groupe multipartite?",
        "expected_docs": ["ITIE_GN_1_4_0"],
        "expected_sections": ["Étape 1", "Étape 2"],
        "must_include_examples": True
    },
    {
        "query": "Seuils de matérialité pour les paiements",
        "expected_docs": ["ITIE_GN_4_1_materiality"],
        "expected_chunk_types": ["data_table", "case_study"],
        "country_context": "Tanzanie"
    },
    {
        "query": "Quelle est l'exigence sur la diversité genre?",
        "expected_requirements": ["1.4.a.ii"],
        "must_include": ["équilibre hommes-femmes", "représentation"]
    }
]
Conclusion
Cette stratégie d'ingestion hybride permet de:

✅ Préserver le contexte hiérarchique via métadonnées enrichies
✅ Maintenir l'intégrité des exemples, tableaux et diagrammes
✅ Optimiser le retrieval avec recherche hybride et reranking
✅ Adapter le chunking selon le type de document
✅ Faciliter la génération de réponses naturelles et précises

Prochaines étapes

Implémenter le pipeline d'extraction de structure
Tester le chunking sur les 2 documents fournis
Valider la qualité avec les requêtes de benchmark
Déployer progressivement sur les 40+ documents
Monitorer et ajuster les paramètres selon les métriques

Cette approche garantit un RAG performant adapté à la complexité et à la diversité de votre base documentaire MREITI. 