/* privafile.net — how-to guides.
 *
 * These pages exist for search terms where a tool page alone will not rank:
 * the "how do I actually do this" questions. Every guide must answer a real
 * question with real detail. No filler, no repeated paragraphs, no padding.
 *
 * Each guide links to the tools it needs and to related guides, so nothing
 * is orphaned — an orphaned page rarely ranks and never converts.
 *
 * `body` is an array of blocks:
 *   { h: 'Heading' }            section heading
 *   { p: 'paragraph' }          paragraph (may contain <strong>, <a>, <code>)
 *   { ul: ['item', 'item'] }    bullet list
 *   { ol: ['step', 'step'] }    numbered list
 *   { note: 'text' }            honest-caveat callout
 *   { tool: 'slug', label: '' } inline tool card
 */

export const guides = [
  {
    slug: 'how-to-merge-pdf-without-uploading',
    title: 'How to Merge PDF Files Without Uploading Them | privafile',
    metaDescription: 'Merging PDFs online usually means uploading them to a stranger. Here is how to combine PDFs entirely on your own device, and how to prove it worked.',
    h1: 'How to merge PDF files without uploading them',
    lede: 'Every popular PDF merger uploads your documents to a server. If you are merging contracts, medical records or ID scans, that matters. This is how to do it without sending anything anywhere.',
    published: '2026-10-08',
    intro: 'When you use an online PDF merger, your file is uploaded to a server, processed there, and returned as a download link. For the few seconds or hours in between, your document exists on hardware you do not control. Most people never think about this, which is exactly why it is worth thinking about.',
    body: [
      { h: 'What actually happens when you use an online merger' },
      { p: 'You pick a file, it travels over the network to a company\'s server, a program changes it, and a link comes back. That is true of the well-known services and the obscure ones alike. The file has to leave your machine, because the processing happens somewhere else.' },
      { p: 'The question worth asking is not whether the file is stored, but <strong>for how long and under what policy</strong>. Some services delete after an hour. Some keep files considerably longer. Some use them to improve their systems. You are relying entirely on their description of their own behaviour, and you have no way to check.' },
      { h: 'Why your browser can do this itself' },
      { p: 'A modern browser is a capable runtime. It can read a file into memory, run the same kind of code a desktop application would, and write a new file to your disk. Combining PDFs — reading page trees and concatenating them — is well within that.' },
      { p: 'The result is that the merge happens on your device. There is no server step at all, so there is nothing to store, nothing to retain, and nothing to leak.' },
      { h: 'Doing it' },
      { ol: [
        'Drop your PDFs into the merge tool. You can select several at once.',
        'Drag the entries to set the final page order. The top file becomes the first pages of the result.',
        'Click merge. Your browser reads each file and writes one combined document.',
        'The merged file downloads straight to your device.'
      ] },
      { tool: 'merge-pdf', label: 'Merge PDF files' },
      { h: 'How to prove nothing was uploaded' },
      { p: 'This is the part worth doing once, because it changes how you read every other tool\'s claims.' },
      { ol: [
        '<strong>Watch the counter.</strong> Every tool page here shows a live count of files uploaded. Use the tool and watch it stay at zero.',
        '<strong>Open developer tools.</strong> Press F12, go to the Network tab, clear it, then merge. Nothing carrying your document appears.',
        '<strong>Go offline.</strong> Load the tool page, disconnect from the internet, then merge. It still works. That is impossible if the processing happened on a server — and it is a demonstration rather than a promise.'
      ] },
      { p: 'The offline test is the strongest of the three, because it does not depend on trusting anyone\'s instrumentation. If the tool completes with no network, nothing was sent.' },
      { h: 'Will merging change the quality?' },
      { p: 'No. Pages are copied as they are rather than re-rendered or re-compressed, so text stays selectable and images keep their original resolution. The combined file is essentially the source files stacked together.' },
      { note: 'A local merge uses your own memory, so a very large set of files can take longer than a server would. That is the trade for not uploading them — and on a laptop, fifty ordinary documents is not a problem.' },
      { h: 'Related' },
      { ul: [
        '<a href="/split-pdf/">Split a PDF into separate files</a>',
        '<a href="/remove-pdf-pages/">Remove pages from a PDF</a>',
        '<a href="/reorder-pdf-pages/">Reorder the pages of a PDF</a>',
        '<a href="/guides/how-to-clean-pdf-before-sending/">Why your PDF still has your name in it</a>'
      ] }
    ],
    relatedTools: ['merge-pdf', 'split-pdf', 'compress-pdf', 'remove-pdf-pages']
  },

  {
    slug: 'how-to-remove-location-from-photo',
    title: 'How to Remove Location Data From a Photo Before Sharing It | privafile',
    metaDescription: 'Most phone photos record exactly where they were taken. Here is how to check for GPS data in a photo and remove it before it leaves your device.',
    h1: 'How to remove your location from a photo before sharing it',
    lede: 'A photograph of your living room can contain the address. Most phone cameras record GPS coordinates by default, and nothing about the picture hints that it does.',
    published: '2026-10-08',
    intro: 'Photographs carry more than pixels. Cameras and phones write an EXIF block into every JPEG: the camera, the settings, the time, and — if location services were on — the coordinates where the shutter fired. For a photo taken at home, that is your address.',
    body: [
      { h: 'The uncomfortable part' },
      { p: 'This is not a hidden setting most people overlooked. It is a default. Phones enable location for the camera because it powers useful features like Photos-on-a-Map. The cost is that every casual snapshot carries a precise location until something strips it.' },
      { p: 'The photo itself gives no indication. You can look at a picture of a room and have no idea it also encodes the building it was taken in.' },
      { h: 'How to check whether a photo carries your location' },
      { ol: [
        'Open the photo in an EXIF viewer.',
        'Look for a GPS section. If coordinates are present, they are in the file.',
        'If a map link appears, you are looking at where the photo places you.'
      ] },
      { tool: 'exif-viewer', label: 'Check a photo for GPS data' },
      { p: 'It is worth doing this once on a photo you were about to post. The result is often more surprising than people expect, particularly for photos taken indoors.' },
      { h: 'Reading the coordinates' },
      { p: 'GPS in a phone photo is as accurate as the fix the phone had at the time. Outdoors with a clear view of the sky, that can be within a few metres. Indoors, it is often the location of the last good fix or a rough network estimate — which may be your neighbourhood rather than your house.' },
      { p: 'Either way, treat it as information you would not hand to a stranger on purpose.' },
      { h: 'Removing it before it goes anywhere' },
      { p: 'The reliable method is to re-encode the image. Instead of selectively deleting fields — where one can easily be missed — the picture is decoded to raw pixels and re-saved without any metadata at all. Camera, lens, timestamps, software, thumbnail and GPS all disappear together, because none of them survive the re-encoding.' },
      { tool: 'strip-exif', label: 'Strip metadata from photos' },
      { note: 'A JPEG re-encoded at 92% quality is visually indistinguishable from the original in almost all cases. If you want to avoid re-compression entirely, choose PNG output — the cost is a larger file.' },
      { h: 'The platforms that strip it for you — and why not to rely on them' },
      { p: 'Most large social networks remove metadata when you upload. That is genuinely helpful, but it has two problems.' },
      { ul: [
        '<strong>They receive the original first.</strong> The data arrives on their servers before being discarded, which means you are trusting their handling of exactly the information you wanted gone.',
        '<strong>Not everywhere does it.</strong> Messaging apps vary widely, and a file attached to an email or sent over a chat has whatever metadata it started with.'
      ] },
      { p: 'Removing the location yourself, before the file goes anywhere, is the version of this you control.' },
      { h: 'Checking your work' },
      { p: 'Run the cleaned file back through the EXIF viewer. The GPS field should be gone, and so should every other field. If anything remains, you are looking at the original rather than the cleaned copy.' },
      { note: 'Removing metadata is not redaction. If your house is visible in the photograph, or your address is printed on the page, stripping EXIF does nothing about that. It only removes what the file recorded.' },
      { h: 'Related' },
      { ul: [
        '<a href="/exif-viewer/">Read the EXIF data in a photo</a>',
        '<a href="/strip-exif/">Remove metadata from photos</a>',
        '<a href="/compress-image/">Compress an image</a>',
        '<a href="/guides/how-to-resize-image-without-losing-quality/">Resize an image without ruining it</a>'
      ] }
    ],
    relatedTools: ['exif-viewer', 'strip-exif', 'compress-image', 'watermark-image']
  },

  {
    slug: 'how-to-add-page-numbers-to-pdf',
    title: 'How to Add Page Numbers to a PDF | privafile',
    metaDescription: 'Add page numbers to a PDF with control over position, format and starting number. Includes skipping a cover page and continuing across volumes.',
    h1: 'How to add page numbers to a PDF',
    lede: 'Straightforward in principle, fiddly in practice — because the interesting cases are the ones a cover page, a second volume, or a mixed batch throw up.',
    published: '2026-10-08',
    intro: 'Numbering a document looks trivial until the first real document. A cover page should not be numbered. A second volume should not restart at one. And "Page 3 of 12" is not interchangeable with "3". This is what to decide before you start.',
    body: [
      { h: 'Decide three things first' },
      { ol: [
        '<strong>Which number to start from.</strong> A first document starts at 1. A document that follows a 40-page first volume starts at 41.',
        '<strong>Whether to skip the opening pages.</strong> A cover or title page conventionally carries no number.',
        '<strong>What the label should say.</strong> Bare numbers suit most documents; "Page 3 of 40" suits anything people will print and refer to aloud.'
      ] },
      { p: 'Getting these straight beforehand saves redoing the whole document, which matters most on a long file.' },
      { h: 'Numbering the document' },
      { ol: [
        'Drop in the PDF.',
        'Choose a position. Bottom centre is the convention for reports and academic documents; bottom right suits business correspondence.',
        'Choose a format and the number to start from.',
        'Click add page numbers. The numbered copy downloads.'
      ] },
      { tool: 'pdf-page-numbers', label: 'Add page numbers to a PDF' },
      { h: 'Handling a cover page' },
      { p: 'Set <strong>Skip first N pages</strong> to 1. The first page is left untouched and numbering begins on page two — but it still starts from the value you chose. So you can have an unnumbered cover followed by a page labelled 1, or followed by a page labelled 2 because the cover counted. Both conventions exist; pick the one your reader expects.' },
      { h: 'Continuing across volumes' },
      { p: 'If the first volume ends at page 40, set the second volume to start at 41. Nothing links the two files, but anyone holding both sees continuous numbering, which is usually the point.' },
      { h: 'Are the numbers real text?' },
      { p: 'Yes. They are drawn with an embedded font, which means they can be selected, copied and searched. A numbering tool that rasterises the page instead would give you numbers that look the same and behave worse — unselectable, unsearchable, and slightly blurred.' },
      { note: 'The numbers are page furniture, not links. Clicking one will not jump anywhere, and they do not create a table of contents.' },
      { h: 'Scanned documents' },
      { p: 'Numbering works the same way. The numbers are drawn as a new layer on top of the existing page image, so it makes no difference whether the page underneath contains any text at all.' },
      { h: 'If the result looks wrong' },
      { p: 'The most common problem is numbering everything when only some pages were rotated or malformed. There is no per-page control here — the tool applies one scheme to the whole document. If a document genuinely needs two different schemes, number it in two passes and combine the results.' },
      { h: 'Related' },
      { ul: [
        '<a href="/pdf-metadata/">Inspect a PDF\'s metadata</a>',
        '<a href="/merge-pdf/">Merge PDFs</a>',
        '<a href="/rotate-pdf/">Rotate the pages of a PDF</a>',
        '<a href="/guides/how-to-clean-pdf-before-sending/">Why your PDF still has your name in it</a>'
      ] }
    ],
    relatedTools: ['pdf-page-numbers', 'merge-pdf', 'rotate-pdf', 'pdf-metadata']
  },

  {
    slug: 'how-to-clean-pdf-before-sending',
    title: 'Why Your PDF Still Has Your Name In It | privafile',
    metaDescription: 'PDFs carry hidden metadata: author, software, creation dates. Here is how to check what a document reveals about you before you send it.',
    h1: 'Why your PDF still has your name in it',
    lede: 'Open the document properties of a PDF you are about to send. There is a decent chance it names you, and you have probably never looked.',
    published: '2026-10-08',
    intro: 'Most PDF readers hide a document-information panel that lists the author, the software that produced the file, and when it was created and last modified. None of it is visible in the document itself. All of it travels with the file.',
    body: [
      { h: 'Where the data comes from' },
      { p: 'Whatever produced the file wrote it. A word processor fills in your name from the account you were signed into, and its own name as the producer. A scanner or phone app fills in its own. A conversion tool from a web service often fills in its own name and the date it ran.' },
      { p: 'This happens whether or not you chose it, which is why documents that look entirely anonymous frequently are not.' },
      { h: 'What is actually recorded' },
      { ul: [
        '<strong>Author</strong> — frequently your real name, taken from the software\'s account settings',
        '<strong>Producer or creator</strong> — the application that generated the file, often with a version number',
        '<strong>Creation and modification dates</strong> — when the file was made and last saved',
        '<strong>Title and subject</strong> — occasionally populated from your document\'s own headings',
        '<strong>Software history</strong> — enough to infer your workflow, and sometimes your employer'
      ] },
      { h: 'Checking a document before you send it' },
      { ol: [
        'Open the PDF in a metadata viewer.',
        'Read the fields it reports. Empty fields mean the file does not record them.',
        'Note anything you would not want a recipient to read.'
      ] },
      { tool: 'pdf-metadata', label: 'Inspect a PDF\'s metadata' },
      { p: 'This takes a few seconds and is worth doing on any document going outside your organisation — a CV, a contract, a proposal, anything attached to a job application.' },
      { h: 'What to do about it' },
      { p: 'The reliable approach is to rewrite the document with the metadata fields emptied. Unlike image metadata, which can be dropped by re-encoding the picture, a PDF\'s metadata is a set of fields you can clear directly.' },
      { note: 'Clearing metadata does not redact content. If your name is printed in the footer of page one, or your address appears in the letterhead, removing metadata changes none of that. Those are visible, and they need editing, which is a different job.' },
      { h: 'An honest caveat about "cleaning"' },
      { p: 'Metadata removal produces a new file. The original still carries the data, so decide which one you keep. If you overwrite your copy with the cleaned version and delete the original, the information is gone from your side too — which is usually what you want, but it does mean the original is unrecoverable.' },
      { p: 'If you need to keep an untouched original for your records, store it somewhere private rather than emailing it to yourself. An email attachment is a copy in someone else\'s system.' },
      { h: 'Related' },
      { ul: [
        '<a href="/pdf-metadata/">Read the metadata in a PDF</a>',
        '<a href="/strip-exif/">Remove metadata from photos</a>',
        '<a href="/guides/how-to-remove-location-from-photo/">Remove location data from a photo</a>',
        '<a href="/compress-pdf/">Compress a PDF</a>'
      ] }
    ],
    relatedTools: ['pdf-metadata', 'compress-pdf', 'strip-exif', 'exif-viewer']
  },

  {
    slug: 'how-to-resize-image-without-losing-quality',
    title: 'How to Resize an Image Without Losing Quality | privafile',
    metaDescription: 'What "resize without losing quality" actually means, why shrinking usually looks fine and enlarging never does, and how to pick dimensions that suit the job.',
    h1: 'How to resize an image without it looking worse',
    lede: 'The phrase "without losing quality" means something specific, and it only applies in one direction. Understanding that one rule explains almost every resizing question.',
    published: '2026-10-08',
    intro: 'Resizing gets discussed as though it were a single operation. It is two, and they behave completely differently. Making an image smaller discards information you had; making it bigger invents information you did not. The first is safe. The second is a guess.',
    body: [
      { h: 'The rule' },
      { p: '<strong>Shrinking always works. Enlarging never adds detail.</strong> If you photograph a leaf at 4000 pixels wide, you have a certain amount of real detail. At 1000 pixels wide you have a quarter of it, cleanly sampled. At 8000 pixels wide you have the same original detail spread across more pixels, plus a lot of guesses about what went in the gaps.' },
      { p: 'So "resize without losing quality" is achievable when you are making an image smaller, and it is not achievable when you are making it larger. No tool changes that, because it is a property of information, not of software.' },
      { h: 'Why shrinking often improves a photo' },
      { p: 'This surprises people. Averaging several pixels into one smooths out sensor noise, and at the smaller size that noise was going to be invisible anyway. A well-downscaled image frequently looks *better* than the original when viewed at the smaller size, because the distracting grain has been averaged away.' },
      { h: 'Choosing dimensions that suit the job' },
      { ul: [
        '<strong>For a website:</strong> decide from the display size, not a round number. An image displayed 400 pixels wide does not need to be 2000 pixels wide; you are sending five times the data for no visible benefit.',
        '<strong>For email or chat:</strong> 1600 pixels on the long edge is generous and keeps the file small.',
        '<strong>For printing:</strong> work backwards from the physical size. A 6 × 4 inch print at 300 dots per inch needs 1800 × 1200.',
        '<strong>For an upload form:</strong> use the limit the form states, and check the file size as well as the dimensions.'
      ] },
      { tool: 'resize-image', label: 'Resize an image' },
      { h: 'When you genuinely must enlarge' },
      { p: 'Sometimes there is no alternative — the only copy you have is small, and the destination needs it bigger. Accept that you are asking software to imagine detail.' },
      { p: 'Practical advice: start from the largest original available, enlarge in one step rather than several, and do not expect sharpness. If the image is being printed, sharpening afterwards helps perception slightly even though it adds no real information.' },
      { note: 'This tool resizes the pixels you have. It does not use a generative model to invent plausible detail, so enlarging beyond roughly 150% will look soft. That is a deliberate choice — invented detail is often wrong, and it is certainly not a photograph of anything.' },
      { h: 'Resizing several images at once' },
      { p: 'Batch the files and they come back as a ZIP. Applying one set of dimensions to a batch is usually what you want for a product listing or a set of thumbnails, but check the aspect ratios first — a batch of mixed portrait and landscape images resized to fixed dimensions will distort the portrait ones.' },
      { h: 'Related' },
      { ul: [
        '<a href="/resize-image/">Resize an image</a>',
        '<a href="/compress-to-target-size/">Compress an image to an exact size</a>',
        '<a href="/crop-image/">Crop an image</a>',
        '<a href="/guides/how-to-remove-location-from-photo/">Remove location data from a photo</a>'
      ] },
    ],
    relatedTools: ['resize-image', 'compress-image', 'compress-to-target-size', 'crop-image']
  },

  {
    slug: 'how-to-split-pdf-into-separate-files',
    title: 'How to Split a PDF Into Separate Files | privafile',
    metaDescription: 'Splitting and extracting are different operations that people mix up. Here is which one you need, and how to do both without uploading the document.',
    h1: 'How to split a PDF into separate files',
    lede: 'Two different jobs get called "splitting". Picking the right one is most of the work.',
    published: '2026-10-08',
    intro: 'If you want to send someone pages 4 to 6, that is extraction: one new file containing those pages. If you want every page as its own file, that is splitting. The tools are different, and using the wrong one produces something you then have to undo.',
    body: [
      { h: 'Which job do you actually have?' },
      { ul: [
        '<strong>Send one section to someone</strong> → extraction. You want a single smaller file.',
        '<strong>Break a book into chapters</strong> → splitting by ranges. Several files, one per chapter.',
        '<strong>One file per page for an archiving system</strong> → splitting every page. Many files, delivered as a ZIP.',
        '<strong>Pull out a signed page</strong> → extraction. One page, one file.'
      ] },
      { h: 'Splitting into separate pages' },
      { p: 'Every page becomes its own PDF. Because that can easily mean dozens of files, the result arrives as a ZIP archive rather than a flood of downloads. Unzip it and you have a folder of single-page documents named after the original.' },
      { tool: 'split-pdf', label: 'Split a PDF into separate files' },
      { h: 'Splitting by ranges' },
      { p: 'For a book or report where the natural boundaries are chapters, specify ranges such as 1-12, 13-30, 31-38. Each range becomes one file. This is almost always what you want for a document with a structure, and it produces a manageable number of files rather than eighty.' },
      { p: 'A useful check before you start: open the document\'s table of contents and write the ranges down first. Deciding boundaries by scrolling through pages tends to produce ranges you then have to redo.' },
      { h: 'Extracting a section instead' },
      { p: 'When you need one file containing a selection, extraction is faster and produces a tidier result. The pages you name are copied into a fresh document; everything else is left behind.' },
      { tool: 'extract-pdf-pages', label: 'Extract pages from a PDF' },
      { h: 'What changes and what does not' },
      { p: 'The page content is preserved exactly. Text stays selectable, images keep their resolution, and nothing is re-rendered. What does not survive is anything that pointed <em>across</em> pages — a bookmark tree, for instance, becomes meaningless once the pages it referenced are in different files.' },
      { p: 'If the original had form fields, splitting separates them too. A multi-page form becomes several single-page forms, each with its own copy of any shared fields.' },
      { note: 'Neither operation changes the original. Both read the source and write new files. Your document is untouched, so if you get the selection wrong, nothing is lost — just run it again.' },
      { h: 'A note on page order in extraction' },
      { p: 'If you type 7,2,5 into the extraction tool, the output is written in document order — 2, 5, 7 — not the order you typed. Extraction is about selecting pages rather than sequencing them. If you genuinely need a different order, extract first and then reorder the result.' },
      { h: 'Keeping the result private' },
      { p: 'Splitting is one of those operations people reach for with exactly the documents they would least like to upload: contracts, statements, medical records. Both tools here work on your own device, and the offline test described in the merge guide applies to them too — load the page, disconnect, and it still works.' },
      { h: 'Related' },
      { ul: [
        '<a href="/split-pdf/">Split a PDF</a>',
        '<a href="/extract-pdf-pages/">Extract pages from a PDF</a>',
        '<a href="/reorder-pdf-pages/">Reorder PDF pages</a>',
        '<a href="/guides/how-to-merge-pdf-without-uploading/">Merge PDFs without uploading them</a>'
      ] }
    ],
    relatedTools: ['split-pdf', 'extract-pdf-pages', 'merge-pdf', 'reorder-pdf-pages']
  },

  {
    slug: 'how-to-convert-images-to-pdf',
    title: 'How to Convert Images to PDF for a Document Upload | privafile',
    metaDescription: 'Turn photos into a single PDF for an upload form. Covers page size, ordering, and hitting the file size limit that portals enforce.',
    h1: 'How to convert images to PDF for a document upload',
    lede: 'Portals demand PDF, you have a phone full of photos, and the small print mentions a size limit. The fiddly parts are the details.',
    published: '2026-10-08',
    intro: 'Upload forms ask for a PDF because it gives the receiving system something predictable: a fixed number of pages at a known size, in an order that will not change. A folder of photos gives it neither. Converting is straightforward, but a few details decide whether the submission is accepted.',
    body: [
      { h: 'Getting the page size right' },
      { p: 'A4 is the standard almost everywhere outside North America; Letter is the standard there. If the form does not say, A4 is the safer default for anything international.' },
      { p: 'Your photo is placed onto the page and scaled to fit. It is not cropped, so the whole image is visible — with margins at the sides or top and bottom depending on the shape of the photo.' },
      { tool: 'jpg-to-pdf', label: 'Convert images to PDF' },
      { h: 'Getting the order right' },
      { p: 'The order you arrange the images becomes the page order. This is the step where submissions fail: a form that expects identification first and proof of address second will be rejected if the pages are reversed, and the reviewer will not guess what you meant.' },
      { p: 'Arrange the images before combining, and check the resulting PDF by opening it and paging through. One misordered page is a rejected application and a wait of days.' },
      { h: 'Hitting the file size limit' },
      { p: 'Portals commonly cap uploads at 2 MB or 5 MB, and photographs are large. A modern phone camera produces several megabytes per image, so two photos can exceed a 5 MB limit on their own.' },
      { p: 'Two things bring the size down, and it is worth knowing which you need:' },
      { ul: [
        '<strong>Compress the images first.</strong> Re-encoding a phone photo at a moderate quality setting typically removes most of the size with no visible difference on a document. Use the image compression tool before combining.',
        '<strong>Reduce the dimensions.</strong> A form that displays your ID at 600 pixels wide gains nothing from a 4000-pixel original. Resizing is often the larger win of the two.'
      ] },
      { p: 'Do the image work first, then combine — shrinking the images inside an already-built PDF is harder than shrinking them before.' },
      { h: 'What the resulting PDF will and will not do' },
      { p: 'The document will contain photographs of pages, not text. That means it will not be searchable and its text cannot be selected or copied.' },
      { note: 'That is normal and usually fine for an upload form, which needs to see the document rather than search it. It only becomes a problem if you are converting photographs of a text document in order to make it searchable — that needs OCR, which is a different operation.' },
      { h: 'If you need searchable text' },
      { p: 'Photos of documents can be converted to searchable PDFs by running optical character recognition over each page and layering the recognised text underneath the image. That is what dedicated OCR tools do, and it produces a file you can search and copy from while still showing the original scan.' },
      { h: 'Related' },
      { ul: [
        '<a href="/jpg-to-pdf/">Convert images to PDF</a>',
        '<a href="/compress-image/">Compress an image</a>',
        '<a href="/resize-image/">Resize an image</a>',
        '<a href="/guides/how-to-resize-image-without-losing-quality/">Resize without losing quality</a>'
      ] }
    ],
    relatedTools: ['jpg-to-pdf', 'compress-image', 'resize-image', 'ocr-image']
  }
];
