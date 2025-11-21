# ✅ IMPLEMENTATION CHECKLIST - DOCUMENT TYPE CONFIGURATION

**Quick Reference Guide for Implementation**
**Last Updated:** November 17, 2025

---

## 📋 PRE-IMPLEMENTATION CHECKS

- [ ] Backup database before starting
- [ ] Create feature branch: `git checkout -b feature/dynamic-document-types`
- [ ] Ensure all current tests pass
- [ ] Review current `documentTypes` usage in codebase
- [ ] Confirm OpenAI API key is configured
- [ ] Verify AWS Textract Lambda is working

---

## 🗂️ FILES TO CREATE (NEW FILES)

```
src/utils/documentTypeDefaults.js          ← Default 8 document type configurations
src/services/promptBuilder.js              ← Dynamic OpenAI prompt generation
src/routes/settingsRoutes.js               ← Settings API routes
src/scripts/migrateDocumentTypeConfigs.js  ← Data migration script
```

---

## ✏️ FILES TO MODIFY (EXISTING FILES)

```
prisma/schema.prisma                        ← Add documentTypeConfigs Json field
src/controllers/documentTypeController.js   ← Complete rewrite with new API
src/controllers/documentController.js       ← Update AI scan logic
src/services/textractService.js             ← Add dynamic prompting
src/routes/documentTypeRoutes.js            ← Keep for backward compatibility
src/server.js                               ← Register settings routes
```

---

## 📝 STEP-BY-STEP EXECUTION ORDER

### PHASE 1: DATABASE (Est. Time: 2 hours)

**Step 1:** Create utility file
```bash
# Create: src/utils/documentTypeDefaults.js
# Contains: DEFAULT_DOCUMENT_TYPES, FIELD_TYPES, validateDocumentTypeConfig()
```
✅ **Test:** `node -e "import('./src/utils/documentTypeDefaults.js').then(m => console.log(Object.keys(m.DEFAULT_DOCUMENT_TYPES)))"`

**Step 2:** Update Prisma schema
```bash
# Edit: prisma/schema.prisma
# Add line 61: documentTypeConfigs Json? @default("{}")
npx prisma format
npx prisma validate
```
✅ **Test:** No syntax errors from validate

**Step 3:** Create and run migration
```bash
npx prisma migrate dev --name add_document_type_configs
npx prisma generate
```
✅ **Test:** `npx prisma studio` - Check Company model has new field

**Step 4:** Create data migration script
```bash
# Create: src/scripts/migrateDocumentTypeConfigs.js
```
✅ **Test:** Dry-run the script

**Step 5:** Run data migration
```bash
node src/scripts/migrateDocumentTypeConfigs.js
```
✅ **Test:** Open Prisma Studio, verify companies have documentTypeConfigs populated

---

### PHASE 2: API CONFIGURATION (Est. Time: 3 hours)

**Step 6:** Rewrite documentTypeController
```bash
# Replace entire file: src/controllers/documentTypeController.js
# New functions: getAllDocumentTypeConfigs, getDocumentTypeConfig,
#                createCustomDocumentType, updateDocumentTypeConfig,
#                deleteCustomDocumentType, getAvailableFieldTypes
```
✅ **Test:** `node --check src/controllers/documentTypeController.js`

**Step 7:** Create settings routes
```bash
# Create: src/routes/settingsRoutes.js
```
✅ **Test:** `node --check src/routes/settingsRoutes.js`

**Step 8:** Register routes in server
```bash
# Edit: src/server.js
# Add: import settingsRoutes
# Add: app.use("/api/settings", ...)
npm run dev
```
✅ **Test:** `curl http://localhost:5003/api/settings/field-types` returns 401 (correct, needs auth)

---

### PHASE 3: AI EXTRACTION (Est. Time: 4 hours)

**Step 9:** Create prompt builder
```bash
# Create: src/services/promptBuilder.js
# Functions: buildDynamicPrompt(), estimateTokens()
```
✅ **Test:** `node --check src/services/promptBuilder.js`

**Step 10:** Update textractService
```bash
# Edit: src/services/textractService.js
# Add: parseWithAIDynamic() function
# Keep: parseWithAI() for backward compatibility
```
✅ **Test:** `node --check src/services/textractService.js`

**Step 11:** Update document controller AI scan
```bash
# Edit: src/controllers/documentController.js
# Modify: scanDocumentWithAI() - Add config checking
# Add: Check aiEnabled flag before processing
```
✅ **Test:** `node --check src/controllers/documentController.js`

---

### PHASE 4: BULK SCAN (Est. Time: 3 hours)

**Step 12:** Add bulk scan endpoint
```bash
# Edit: src/controllers/documentController.js
# Add: bulkScanAllDocuments() function
```
✅ **Test:** Function compiles without errors

**Step 13:** Register bulk scan route
```bash
# Edit: src/routes/documentRoutes.js
# Add: POST /bulk-scan-all/:driverId
```
✅ **Test:** Route registered, returns 401 without auth

---

### PHASE 5: TESTING (Est. Time: 4 hours)

**Step 14:** Test document type configuration API
```bash
# Test: GET /api/settings/document-types
# Test: GET /api/settings/document-types/Driver's%20Licence
# Test: POST /api/settings/document-types (create custom type)
# Test: PUT /api/settings/document-types/CustomType
# Test: DELETE /api/settings/document-types/CustomType
```

**Step 15:** Test AI extraction with different modes
```bash
# Test: Upload document → Set type to "WHMIS/Training Certificates"
# Test: Trigger AI scan → Should only classify, not extract fields
# Test: Upload document → Set type to "Driver's Licence"
# Test: Trigger AI scan → Should extract province, class, expiryDate
```

**Step 16:** Test bulk scan
```bash
# Test: Upload 5 documents with different types
# Test: Trigger bulk scan → All should be processed
# Test: Check credits deducted correctly
# Test: Verify all documents updated with extracted data
```

---

## ⚠️ CRITICAL POINTS TO VERIFY

### Before Deployment:
- [ ] All existing documents still load correctly
- [ ] Old `documentTypes` array not broken
- [ ] AI credits deduct only when aiEnabled=true
- [ ] Classification-only mode charges credits but doesn't extract fields
- [ ] Bulk scan handles errors gracefully
- [ ] Cannot delete default document types
- [ ] Can delete custom document types
- [ ] Validation prevents invalid configurations

### Performance:
- [ ] Bulk scan doesn't timeout (test with 20+ documents)
- [ ] Dynamic prompts reduce token usage by 20-40%
- [ ] OpenAI calls don't exceed rate limits

### Security:
- [ ] All endpoints require authentication
- [ ] DSP permissions enforced (manage_company_settings)
- [ ] Cannot access other company's configurations

---

## 🔄 ROLLBACK PLAN

If something goes wrong:

**Database Rollback:**
```bash
# Revert migration
npx prisma migrate resolve --rolled-back 20251117XXXXXX_add_document_type_configs

# Re-run previous migration
npx prisma migrate deploy
```

**Code Rollback:**
```bash
git checkout main
git branch -D feature/dynamic-document-types
npm run dev
```

**Data Recovery:**
```bash
# If you backed up before migration:
# Restore database from backup
# Re-run app without documentTypeConfigs logic
```

---

## 📊 TESTING CHECKLIST

### Unit Tests
- [ ] validateDocumentTypeConfig() validates correctly
- [ ] buildDynamicPrompt() generates correct prompts
- [ ] getAllDocumentTypeConfigs() returns all configs
- [ ] createCustomDocumentType() validates fields
- [ ] parseWithAIDynamic() extracts correct fields

### Integration Tests
- [ ] End-to-end: Create custom type → Upload document → AI scan → Verify extraction
- [ ] End-to-end: Bulk scan 10 mixed documents → All processed correctly
- [ ] Backward compatibility: Old documents still work
- [ ] Credit deduction: AI disabled type doesn't charge

### Load Tests
- [ ] Bulk scan 50 documents simultaneously
- [ ] Multiple companies using AI scan at once
- [ ] Large document (10+ pages) extraction

---

## 📈 SUCCESS METRICS

After deployment, verify:
- [ ] No increase in error rate
- [ ] AI token usage decreased by 20-30%
- [ ] Bulk scan completes within acceptable time (< 5 min for 20 docs)
- [ ] No user-reported issues with existing functionality
- [ ] Settings page loads configurations correctly

---

## 🚀 DEPLOYMENT STEPS

1. **Merge to main:**
   ```bash
   git checkout main
   git merge feature/dynamic-document-types
   git push origin main
   ```

2. **Deploy to staging:**
   ```bash
   # Run migrations on staging DB
   npx prisma migrate deploy

   # Run data migration
   node src/scripts/migrateDocumentTypeConfigs.js

   # Restart server
   pm2 restart logilink-backend
   ```

3. **Test on staging:**
   - [ ] All endpoints respond correctly
   - [ ] AI extraction works
   - [ ] Bulk scan works
   - [ ] No errors in logs

4. **Deploy to production:**
   ```bash
   # Backup production DB first!
   # Run migrations
   # Run data migration
   # Restart server
   # Monitor logs for 1 hour
   ```

---

## 📞 SUPPORT CONTACTS

- **Database Issues:** Check Prisma logs, verify migrations
- **API Issues:** Check server logs, verify routes registered
- **AI Issues:** Check OpenAI API keys, verify token usage
- **Frontend Issues:** Provide API documentation to frontend team

---

## 📚 API DOCUMENTATION SUMMARY

### Settings Endpoints
```
GET    /api/settings/document-types           → Get all configs
GET    /api/settings/field-types              → Get available field types
GET    /api/settings/document-types/:name     → Get specific config
POST   /api/settings/document-types           → Create custom type
PUT    /api/settings/document-types/:name     → Update config
DELETE /api/settings/document-types/:name     → Delete custom type
```

### Document Endpoints (Modified)
```
POST   /api/documents/:documentId/ai-scan     → Now checks aiEnabled flag
POST   /api/documents/bulk-scan-all/:driverId → NEW: Bulk scan all pending
```

---

**END OF CHECKLIST**

Refer to `IMPLEMENTATION_PLAN.md` for detailed code examples and explanations.
