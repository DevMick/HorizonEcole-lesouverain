const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

// Path to template
const templatePath = path.join(__dirname, '..', 'templates', 'payment-receipt', 'receipt-template.docx');

if (!fs.existsSync(templatePath)) {
  console.error('❌ Template file not found at:', templatePath);
  process.exit(1);
}

console.log('📄 Reading template from:', templatePath);
console.log('');

// Read the Word document (it's a ZIP file)
const content = fs.readFileSync(templatePath, 'binary');
const zip = new PizZip(content);

// Get the main document XML
const documentXml = zip.files['word/document.xml'];
if (!documentXml) {
  console.error('❌ word/document.xml not found in template');
  process.exit(1);
}

const xmlContent = documentXml.asText();

console.log('📋 Analyzing template placeholders...');
console.log('');

// Find all potential placeholders - check for fragmented ones
// Using %variable% format
const placeholderPattern = /%[^%]*%/g;
const matches = xmlContent.match(placeholderPattern);

// Also check for fragmented placeholders (where % and % are in separate XML elements)
// This happens when Word splits the placeholder across multiple <w:t> elements
const fragmentedMatches = [];

// Method 1: Check for %...% that spans multiple <w:t> elements
const fragmentedPattern1 = /<w:t[^>]*>%<\/w:t>[\s\S]*?<w:t[^>]*>([^<]+)<\/w:t>[\s\S]*?<w:t[^>]*>%<\/w:t>/g;
let fragMatch;
while ((fragMatch = fragmentedPattern1.exec(xmlContent)) !== null) {
  fragmentedMatches.push({
    full: fragMatch[0],
    variable: fragMatch[1],
    position: fragMatch.index,
    type: 'split-across-elements'
  });
}

// Method 2: Check for placeholders that contain XML tags inside them (indicating fragmentation)
if (matches) {
  matches.forEach((match, idx) => {
    // If the match contains XML tags, it's likely fragmented
    if (match.includes('</w:t>') || match.includes('<w:t') || match.includes('<w:r') || match.includes('<w:p')) {
      // Extract the variable name if possible (using % as delimiters)
      const varMatch = match.match(/%([^%]+)%/);
      if (varMatch) {
        fragmentedMatches.push({
          full: match,
          variable: varMatch[1],
          position: xmlContent.indexOf(match),
          type: 'contains-xml-tags'
        });
      }
    }
  });
}

if (!matches || matches.length === 0) {
  console.log('⚠️  No placeholders found with pattern %variable%');
  console.log('');
  console.log('Looking for any placeholders...');
  const allPlaceholders = xmlContent.match(/%[^%]*%/g);
  if (allPlaceholders) {
    console.log('Found placeholders:', allPlaceholders.slice(0, 10));
  }
} else {
  console.log(`✅ Found ${matches.length} potential placeholders:`);
  console.log('');
  
  // Group by unique placeholders
  const uniquePlaceholders = [...new Set(matches)];
  
  uniquePlaceholders.forEach((placeholder, index) => {
    const count = matches.filter(m => m === placeholder).length;
    const cleanPlaceholder = placeholder.replace(/\s+/g, ' ').trim();
    
    // Check for duplicate delimiters
    const percentSigns = (placeholder.match(/%/g) || []).length;
    
    let status = '✅';
    let issue = '';
    
    if (percentSigns > 2) {
      status = '❌';
      issue = ` - DUPLICATE DELIMITERS! Found ${percentSigns} % signs (expected 2)`;
    } else if (percentSigns !== 2) {
      status = '⚠️';
      issue = ` - UNBALANCED! Found ${percentSigns} % signs (expected 2)`;
    }
    
    console.log(`${status} [${index + 1}] ${cleanPlaceholder}${issue}`);
    if (count > 1) {
      console.log(`   (appears ${count} times in document)`);
    }
  });
}

console.log('');
console.log('🔍 Checking for common issues...');
console.log('');

// Check for common issues
const issues = [];

// Check for quadruple braces
if (xmlContent.includes('{{{{')) {
  issues.push('❌ Found quadruple opening braces: {{{{');
}
if (xmlContent.includes('}}}}')) {
  issues.push('❌ Found quadruple closing braces: }}}}');
}

// Check for triple braces
if (xmlContent.includes('{{{') && !xmlContent.includes('{{{{')) {
  issues.push('⚠️  Found triple opening braces: {{{');
}
if (xmlContent.includes('}}}') && !xmlContent.includes('}}}}')) {
  issues.push('⚠️  Found triple closing braces: }}}');
}

// Check for spaces in placeholders
const placeholdersWithSpaces = matches?.filter(m => /\{\{[^}]*\s+[^}]*\}\}/.test(m));
if (placeholdersWithSpaces && placeholdersWithSpaces.length > 0) {
  issues.push(`⚠️  Found ${placeholdersWithSpaces.length} placeholders with spaces inside`);
}

if (issues.length === 0) {
  console.log('✅ No obvious issues found in template structure');
} else {
  issues.forEach(issue => console.log(issue));
}

console.log('');
if (fragmentedMatches.length > 0) {
  console.log('❌ FOUND FRAGMENTED PLACEHOLDERS!');
  console.log(`   Word has split ${fragmentedMatches.length} placeholders across multiple XML elements.`);
  console.log('   This will cause "Duplicate open tag" and "Duplicate close tag" errors.');
  console.log('');
  console.log('   Fragmented placeholders:');
  // Remove duplicates
  const uniqueFragments = [];
  const seen = new Set();
  fragmentedMatches.forEach((frag) => {
    const key = frag.variable || frag.full.substring(0, 50);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFragments.push(frag);
    }
  });
  
  uniqueFragments.forEach((frag, idx) => {
    console.log(`   [${idx + 1}] %${frag.variable || 'unknown'}% - ${frag.type}`);
    console.log(`       Position: ${frag.position}`);
    console.log(`       XML snippet: ${frag.full.substring(0, 200)}...`);
  });
  console.log('');
  console.log('   SOLUTION:');
  console.log('   1. Ouvrez le document Word');
  console.log('   2. Pour chaque placeholder fragmenté:');
  console.log('      - Sélectionnez TOUT le texte du placeholder (y compris les %)');
  console.log('      - Supprimez-le complètement');
  console.log('      - Retapez-le d\'un seul coup: %variable%');
  console.log('      - OU copiez depuis Notepad et collez-le');
  console.log('   3. Sauvegardez le document');
  console.log('   4. Relancez ce script pour vérifier');
} else {
  console.log('✅ No fragmented placeholders found');
}

console.log('');
console.log('🔍 Searching for different placeholder formats:');
console.log('');

// Check for old format {{...}}
const oldFormatMatches = xmlContent.match(/\{\{[^}]*\}\}/g);
if (oldFormatMatches && oldFormatMatches.length > 0) {
  console.log(`⚠️  Found ${oldFormatMatches.length} placeholders with OLD format {{...}}:`);
  const uniqueOld = [...new Set(oldFormatMatches)];
  uniqueOld.slice(0, 5).forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.substring(0, 50)}...`);
  });
  console.log('   ⚠️  These need to be changed to %variable% format!');
} else {
  console.log('✅ No old format placeholders ({{...}}) found');
}

// Check for new format %variable%
const newFormatMatches = xmlContent.match(/%[^%]*%/g);

if (newFormatMatches && newFormatMatches.length > 0) {
  // Filter out placeholders that are just %%
  const validPlaceholders = newFormatMatches.filter(p => p.length > 2);
  if (validPlaceholders.length > 0) {
    console.log(`✅ Found ${validPlaceholders.length} placeholders with NEW format %variable%:`);
    const uniqueNew = [...new Set(validPlaceholders)];
    uniqueNew.forEach((p, i) => {
      // Clean up the placeholder for display
      const cleaned = p.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      console.log(`   ${i + 1}. ${cleaned}`);
    });
  } else {
    console.log('⚠️  Found % signs but no valid %variable% placeholders');
  }
} else {
  console.log('⚠️  No new format placeholders (%variable%) found');
}

// Check for any {{ pattern (old format)
const anyOpenBraces = xmlContent.match(/\{\{/g);
if (anyOpenBraces) {
  console.log(`\n📊 Total {{ found in document: ${anyOpenBraces.length} (old format)`);
}

// Check for any % pattern (new format)
const anyPercent = xmlContent.match(/%/g);
if (anyPercent) {
  const expectedPlaceholders = Math.floor(anyPercent.length / 2);
  console.log(`📊 Total % found in document: ${anyPercent.length} (could be ${expectedPlaceholders} placeholders)`);
}

console.log('');
console.log('📝 Sample of document XML (first 2000 characters):');
console.log('─'.repeat(80));
console.log(xmlContent.substring(0, 2000));
console.log('─'.repeat(80));

