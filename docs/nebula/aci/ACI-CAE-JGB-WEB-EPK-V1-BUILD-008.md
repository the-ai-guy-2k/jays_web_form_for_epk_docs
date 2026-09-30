# ACI-CAE-JGB-WEB-EPK-V1-BUILD-008 (archived verbatim)

```text
ACI-CAE-JGB-WEB-EPK-V1-BUILD-008
JAY GARRETT WEB EPK V1 — NEW BRANCH PRODUCTION BUILD
OPERATOR
T / Sanil D Tison
DOMAIN
TAIG Promotions
CLIENT / ARTIST
Jay Garrett / Jay Garrett Band
PLANNING / AUTHORITY NODE
Jay Garrett Band bQEN
EXECUTION NODE
CAE
MODE
Governed Software Build / Existing-Code Evolution / Production-Version Development
0. EXECUTION FORECAST
Expected result:
Existing working Jay EPK codebase
→ new isolated V1 branch
→ existing intake capability preserved
→ public Web EPK V1 built
→ local validation completed
→ new branch pushed to GitHub
→ returned to bQEN for review
This ACI does not authorize Replit deployment, production replacement, or PAPEV.
Those occur later under separate authorization.
1. MISSION
Build the first production version of the Jay Garrett Public Web EPK V1 using the existing Jay EPK repository and application as the technical foundation.
Do not rebuild the project from scratch.
Do not modify or destroy the existing working intake implementation.
Create a new Git branch specifically for the Web EPK V1 build.
The completed branch will later be supplied to Replit under a separate ACI for production deployment and PAPEV.
2. GOVERNING ARTIFACT
Consume the complete governing artifact before implementation:
GVCA-ACICE — Jay Garrett Web EPK V1
Google Drive:
https://docs.google.com/document/d/1y0n-ZGWGp05z1wt3OFdyQNd5yLG_qiEMpugf3BxvLkw/edit
The GVCA-ACICE is the controlling product-intent artifact.
Where this ACI and the GVCA-ACICE differ materially:
STOP and report the conflict.
Do not independently reinterpret product intent.
3. EXISTING SOURCE
GitHub account:
the-ai-guy-2k
Repository:
jays_web_form_for_epk_docs
Repository:
the-ai-guy-2k/jays_web_form_for_epk_docs
Existing working development lineage:
feature/aci-001
CAE must first:
1. fetch the repository,
2. inspect all branches,
3. identify the latest remote HEAD of the existing working Jay implementation,
4. verify the current source state,
5. create the new V1 branch from that current remote state.
Do not anchor the new branch to an old historical SHA merely because one appears in prior instructions.
Use the latest supported repository state.
4. NEW BRANCH
Create:
feature/jay-web-epk-v1
The new branch becomes the isolated build lane for the Jay Garrett Public Web EPK V1.
Do not delete, overwrite, rename, force-push, or otherwise damage:
feature/aci-001
or any other existing branch.
5. PRESERVATION REQUIREMENT
The existing intake capability is valuable TAIG product work.
It must remain recoverable.
Existing capability includes, where currently implemented:
- guided artist intake
- multiple intake sections
- Save Progress
- Save & Return
- draft persistence
- final Review
- Submit
- TAIG review capability
- protected administrative access
- protected JSON/export capability
- existing data structures
- existing database/persistence logic
The new public EPK must not erase this capability from repository history or destroy its recoverability.
The current production deployment must remain untouched during this ACI.
6. TARGET CAPABILITY
Build one capability:
PUBLIC JAY GARRETT WEB EPK V1
The public experience should no longer feel like an intake application.
It should feel like a professional, modern, media-facing country artist Electronic Press Kit.
Primary recipients include:
- radio stations
- music publications
- journalists
- promoters
- venues
- booking contacts
- music-industry contacts
7. APPROVED CURRENT TRUTH
Only approved artist truth may be represented as factual content.
Artist:
Jay Garrett / Jay Garrett Band
Region:
Jacksonville / Northeast Florida
Genre:
Country
Roles:
Singer / Songwriter / Guitarist
Album:
Still Chasing the Sundown
Release:
October 19, 2026
Track count:
12
Produced and engineered by:
Scott Harter
Production location:
Nashville, Tennessee
Songwriting:
All songs written or co-written by Jay Garrett.
Track list:
1. Something We Can Stomp To
2. Same Old Lame Old
3. Karma Catching Up
4. Dann Run
5. Sippin' on a Sangria
6. Let Me Be Strong
7. Sure Got You
8. Why My Horse?
9. Her Hidden Powers
10. The Way You Carry Yourself
11. As You Derail
12. (You'll Find Me) Down by the River
Featured tracks:
- Karma Catching Up
- Something We Can Stomp To
8. APPROVED BIO
Use the approved bio contained in the governing GVCA-ACICE.
Do not rewrite Jay's history into materially different factual claims.
Minor presentation formatting is permitted.
Factual alteration is not.
9. APPROVED ONLINE DESTINATIONS
Official website:
https://www.jaygarrettmusic.com/
Spotify — Jay Garrett:
https://open.spotify.com/artist/5YOopHdU7HYWvT6dZV137W
Spotify — Jay Garrett Band:
https://open.spotify.com/artist/3bcSjBtwGPuUwsrqmopdah
Apple Music — Jay Garrett:
https://music.apple.com/us/artist/jay-garrett/3978898
Apple Music — Jay Garrett Band:
https://music.apple.com/us/artist/jay-garrett-band/1473713956
Amazon Music — Jay Garrett Band:
https://music.amazon.com/artists/B07VH6Z93K/jay-garrett-band
YouTube — Jay Garrett Band:
https://www.youtube.com/channel/UCf_pTuQJN5m7HDy82lryEeQ/about
Facebook:
https://www.facebook.com/jay.garrett.167/
Do not invent additional official accounts.
10. V1 INFORMATION ARCHITECTURE
Build an effective professional single-public-destination EPK using the available approved content and validated assets.
Expected presentation areas include:
- Artist hero / identity
- Still Chasing the Sundown feature
- release date
- featured music
- album track list
- artist bio
- artist photography
- album artwork
- music / streaming destinations
- video, where usable validated material already exists
- career / radio / press proof only where supported
- social destinations
- media / booking / business contact where supported
- downloadable press assets where already available and appropriate
CAE may improve ordering and presentation when needed for good UX.
Do not alter factual truth.
11. EXPERIENCE TARGET
The site should feel:
- professional
- authentic
- modern country
- warm
- cinematic
- credible
- clean
- easy to scan
- mobile-first
- media-friendly
- fast
Avoid:
- generic cowboy clichés
- fake western imagery
- unrelated human faces
- fake awards
- fake press quotes
- fake statistics
- invented streaming numbers
- invented radio history
- fabricated testimonials
- visual clutter
- unnecessary application complexity
12. EXISTING VISUAL WORK
Reuse existing project assets where appropriate.
Do not assume the former intake visual treatment must dictate the Web EPK.
The public EPK may receive a distinct presentation layer appropriate to Jay's professional artist identity.
However:
do not introduce unrelated people or stock musicians.
Use Jay-specific validated imagery/assets where available.
If a required visual asset is absent, design gracefully around the absence rather than inventing one.
13. STRUCTURED ARTIST DATA
Separate artist content from presentation logic wherever reasonably practical.
Desired architectural direction:
Structured Artist Data → Web EPK Presentation
Examples may include:
- JSON
- JS/TS data object
- structured configuration
- equivalent maintainable content model
Exact implementation pattern is CAE's technical responsibility.
Do not create V2 editing capability.
The purpose is only to avoid unnecessarily hard-coding all artist truth throughout presentation code.
14. V1 SCOPE
IN SCOPE
- public Jay Garrett Web EPK
- approved artist information
- approved album information
- validated existing assets
- responsive presentation
- music/platform links
- social links
- media-facing information hierarchy
- appropriate contact presentation
- existing downloadable press material where available
- structured content architecture
- preservation of intake implementation
- local build validation
- Git branch creation
- remote GitHub push
OUT OF SCOPE
Do not build:
- V2 content editor
- CMS
- admin dashboard for EPK editing
- Jay login
- arbitrary public editing
- full artist website
- merchandise
- e-commerce
- ticketing
- fan accounts
- mailing-list platform
- custom analytics platform
- unrelated TAIG features
- Replit deployment
- production cutover
- PAPEV execution
15. ROUTING BEHAVIOR
On the new V1 branch only, the normal public root experience should represent the Public Web EPK.
Expected eventual production behavior:
/
→ Jay Garrett Public Web EPK
The existing intake functionality may remain available internally in code or under a non-primary route as technically sensible, but CAE must not expose private submission/admin information publicly.
Do not modify the currently deployed Replit environment during this ACI.
16. SECURITY / PRIVACY
Preserve existing security boundaries.
The public EPK must not expose:
- intake submissions
- draft data
- private resume tokens
- TAIG administrative views
- review tokens
- secrets
- environment variables
- database credentials
- raw database access
Do not commit:
- .env
- credentials
- tokens
- production database data
- user submissions
- private artist data not approved for public release
17. CONTACT BEHAVIOR
Use only validated contact information already present in the project or governing sources.
If appropriate public contact information cannot be established from authorized sources:
do not invent it.
Instead record the missing item in the CAE return.
18. BUILD QUALITY
Implementation should be production-oriented.
At minimum:
- semantic HTML where practical
- responsive behavior
- keyboard-usable navigation
- reasonable accessibility
- appropriate image alt text
- no obvious layout overflow
- graceful missing-asset handling
- clear external-link behavior
- no broken internal routing
- reasonable performance
- clean console under normal use
- no exposed secrets
- no exposed private intake data
19. LOCAL VALIDATION
CAE must validate the build before returning PASS.
At minimum test:
1. application starts successfully
2. root loads Web EPK
3. page clearly presents as EPK rather than intake
4. artist name correct
5. album title correct
6. release date correct
7. 12-track list correct
8. featured tracks correct
9. approved bio represented accurately
10. streaming links present and correctly mapped
11. social links correctly mapped
12. existing intake capability remains recoverable
13. Save & Return capability has not been unintentionally destroyed
14. TAIG administrative/private routes are not publicly exposed
15. no public submission enumeration
16. no secrets rendered client-side
17. no secrets committed
18. mobile layout passes practical review
19. desktop layout passes practical review
20. major interactive elements work
21. missing optional assets do not break page
22. project restart succeeds
23. automated tests pass
24. existing relevant regression tests pass or are intentionally updated with documented reason
25. Git working tree is clean at completion
Add further tests where technically warranted.
20. CHANGE CONTROL
If implementation reveals a requirement that materially changes:
- mission
- V1 scope
- architecture direction
- preservation strategy
- security
- approved artist truth
- deployment strategy
- external cost
STOP the affected work.
Return the issue to the bQEN.
Do not silently expand scope.
21. MINORITY REPORT CONTROL
If CAE discovers a material problem that makes the approved path wrong, incomplete, unsafe, or likely to create material rework:
STOP or continue only as technically safe and explicitly report the issue.
The bQEN will determine whether a formal Minority Report is warranted under Nebula governance.
Do not bury material disagreement in implementation notes.
22. GIT REQUIREMENTS
Before editing:
- fetch origin
- verify remote state
- record starting branch
- record starting SHA
Create:
feature/jay-web-epk-v1
Perform all V1 work there.
At completion:
- commit changes
- push the branch to origin
- verify remote branch exists
- verify local HEAD == remote HEAD
Preferred commit message:
ACI-008: build Jay Garrett public Web EPK V1
Additional commits are allowed when technically justified.
No force push.
23. BUILD-STAGE CONTROL
For this ACI:
Public Web EPK V1
Production Version — CURRENT ACTIVE STAGE
Do not claim:
Release Candidate — REACHED
merely because CAE finished coding.
Release Candidate status requires bQEN review of the returned evidence and the next applicable governance gate.
Do not claim:
Production QA / PAPEV — REACHED
PAPEV will occur later through Replit under separate authorization.
24. REPLIT HANDOFF INTENT
The completed GitHub branch:
feature/jay-web-epk-v1
will be the source supplied to Replit later.
Planned next path:
CAE Build
→ bQEN evidence review
→ Release Candidate gate
→ Replit pulls feature/jay-web-epk-v1
→ production candidate deployment
→ PAPEV
→ Operator release approval
→ production replacement
CAE must not perform the Replit steps in this ACI.
25. REQUIRED CAE RETURN
Return:
ACI STATUS
PASS / PARTIAL / FAIL
SOURCE BASELINE
- repository
- original source branch
- starting SHA
- basis for selecting that source state
NEW BUILD BRANCH
- branch name
- final local SHA
- final remote SHA
- remote verification result
BUILD SUMMARY
What changed.
PUBLIC EPK
Confirm:
- root behavior
- sections implemented
- structured data approach
- responsive behavior
INTAKE PRESERVATION
State exactly how the existing intake capability remains recoverable.
ASSETS
List:
- used
- missing
- intentionally omitted
- unresolved
VALIDATION
Return individual PASS / FAIL results.
SECURITY
Confirm:
- .env committed: YES / NO
- secrets detected: YES / NO
- private submission data exposed: YES / NO
- database/runtime data committed: YES / NO
REGRESSION
State whether existing application capabilities were unintentionally broken.
BUILD STAGE
Return:
- Production Version — REACHED / PARTIAL / BLOCKED
- Release Candidate — NOT REACHED
- Production QA / PAPEV — NOT REACHED
ISSUES / BLOCKERS
List only material issues.
RECOMMENDED NEXT GATE
State whether the branch is ready for:
bQEN review for Release Candidate promotion
26. STOP CONDITION
Stop after:
1. the Public Web EPK V1 is built locally,
2. required validation is completed,
3. the existing intake capability is preserved,
4. feature/jay-web-epk-v1 is committed and pushed,
5. local and remote HEAD are verified equal,
6. the complete CAE execution report is returned.
Do not deploy to Replit.
Do not replace the current live intake.
Do not initiate PAPEV.
CORE EXECUTION PRINCIPLE
Use what already works.
Preserve what already has value.
Build the new public EPK in isolation.
Prove it before promotion.
Replit pulls the accepted branch for PAPEV — not before.
Advance the Truth Till Mission Completion.
```
