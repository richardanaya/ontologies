import * as fs from "fs";
import showdown from "showdown";

type OntologyChain = string[];
type Relationship = {
  parentConcept: string;
  childAspect: string;
};

const primaryOntologicalRelations: Relationship[] = [];

function generateSubOntologies(
  parentChilds: Relationship[],
  conceptStart: string
): OntologyChain[] {
  let innovativeParentChilds = [...parentChilds];

  // filter out primary ontological relations
  innovativeParentChilds = innovativeParentChilds.filter((parentChild) => {
    // if it doesn't exist in primary ontological relations
    if (
      primaryOntologicalRelations.find((primaryOntologicalRelation) => {
        return (
          primaryOntologicalRelation.parentConcept ===
            parentChild.parentConcept &&
          primaryOntologicalRelation.childAspect === parentChild.childAspect
        );
      }) === undefined
    ) {
      return true;
    }
    return false;
  });

  const chains: OntologyChain[] = [];
  const maxDepth = 5;

  const traverse = (
    currentChain: OntologyChain,
    currentConcept: string,
    depth: number
  ) => {
    if (depth > maxDepth) {
      return;
    }

    const children = innovativeParentChilds.filter(
      (parentChild) => parentChild.parentConcept === currentConcept
    );

    if (children.length === 0) {
      chains.push(currentChain);
      return;
    }

    for (const child of children) {
      const newChain = [...currentChain, child.childAspect];
      traverse(newChain, child.childAspect, depth + 1);
    }
  };

  const rootConcepts = innovativeParentChilds.filter(
    (parentChild) => parentChild.parentConcept === conceptStart
  );

  for (const rootConcept of rootConcepts) {
    traverse([rootConcept.parentConcept], rootConcept.parentConcept, 0);
  }

  return chains;
}

async function generate() {
  const ignoreDirs = ["node_modules", ".git", ".obsidian"];

  const pathFromArgs = process.argv[2];

  const outputHTMLFile = "ontologies.html";

  // delete if exists
  if (fs.existsSync(outputHTMLFile)) {
    fs.unlinkSync(outputHTMLFile);
  }

  // create new file
  fs.writeFileSync(outputHTMLFile, "");

  const htmlStart = `
<!DOCTYPE html>
<html>
  <head>
    <title>Ontologies</title>
    <link rel="stylesheet" href="./ontology.css">
  </head>
  <body>
    <h1>Ontologies</h1>
    <h4>By Richard Anaya II</h4>
    <hr/>
    <h1>Table of Contents</h1>
    <hr/>
`;

  fs.appendFileSync(outputHTMLFile, htmlStart);

  // TABLE OF CONTENTS

  const tableOfContents = [];

  // traverse through directories at path
  const traverseTOC = async (path: string) => {
    if (ignoreDirs.includes(path.split("/").pop()!)) {
      return;
    }
    const files = await fs.promises.readdir(path, { withFileTypes: true });

    const chapterTitle = path.split("/").pop();

    const directories: fs.Dirent[] = [];

    for (const file of files) {
      const filePath = path + "/" + file.name;
      if (file.isDirectory()) {
        directories.push(file);
      }
    }

    const orderedFiles = [...directories];

    fs.appendFileSync(outputHTMLFile, `<div style="margin-left: 1rem">`);
    for (const file of orderedFiles) {
      const filePath = path + "/" + file.name;
      if (file.isDirectory()) {
        if (ignoreDirs.includes(file.name)) {
          continue;
        }
        let fileDirName = file.name;
        fs.appendFileSync(
          outputHTMLFile,
          `<a href="#${fileDirName}">${fileDirName}</a><br>`
        );
        primaryOntologicalRelations.push({
          parentConcept: chapterTitle + "",
          childAspect: fileDirName,
        });
        await traverseTOC(filePath);
      }
    }
    fs.appendFileSync(outputHTMLFile, `</div>`);
  };

  await traverseTOC(pathFromArgs);

  fs.appendFileSync(outputHTMLFile, "<h1>Pages</h1><hr/>");

  const mentions: {
    [key in string]: { source: string; snippet: string }[];
  } = {};

  const parentChilds: {
    parentConcept: string;
    childAspect: string;
  }[] = [];
  const traverseMentions = async (path: string) => {
    if (ignoreDirs.includes(path.split("/").pop()!)) {
      return;
    }
    const files = await fs.promises.readdir(path, { withFileTypes: true });

    for (const file of files) {
      const filePath = path + "/" + file.name;
      if (file.isDirectory()) {
        await traverseMentions(filePath);
      } else {
        // if file is markdown
        if (filePath.endsWith(".md")) {
          const fileName = file.name;
          const filePathWithoutExtension = fileName.split(".md")[0];
          const markdown = fs.readFileSync(filePath, "utf-8");
          const mentionsInFile = markdown.match(/\[\[(.*?)\]\]/g);
          if (mentionsInFile) {
            mentionsInFile.forEach((mention) => {
              const mentionStripped = mention
                .replace("[[", "")
                .replace("]]", "");
              parentChilds.push({
                parentConcept: filePathWithoutExtension,
                childAspect: mentionStripped,
              });
              const locationOfRegex = markdown.indexOf(mention);
              // get the surrounding sentence around mention
              const mentionSnippet = markdown.substring(
                Math.max(locationOfRegex - 100, 0),
                Math.min(locationOfRegex + 100, markdown.length)
              );
              if (!mentions[mentionStripped]) {
                mentions[mentionStripped] = [];
              }
              mentions[mentionStripped].push({
                source: filePathWithoutExtension,
                snippet: mentionSnippet,
              });
            });
          }
        }
      }
    }
  };
  await traverseMentions(pathFromArgs);

  // PAGES
  const traverse = async (path: string) => {
    if (ignoreDirs.includes(path.split("/").pop()!)) {
      return;
    }
    const files = await fs.promises.readdir(path, { withFileTypes: true });

    const chapterTitle = path.split("/").pop();

    fs.appendFileSync(
      outputHTMLFile,
      `<h2 id="${chapterTitle}">${chapterTitle}</h2><hr>`
    );

    const filesSameNameAsDir: fs.Dirent[] = [];
    const otherFiles: fs.Dirent[] = [];
    const directories: fs.Dirent[] = [];

    for (const file of files) {
      const filePath = path + "/" + file.name;
      if (file.isDirectory()) {
        directories.push(file);
      } else {
        // if file is markdown
        if (filePath.endsWith(".md")) {
          const fileName = file.name;
          const fileNameSameAsDirectory = fileName === chapterTitle + ".md";

          if (fileNameSameAsDirectory) {
            filesSameNameAsDir.push(file);
          } else {
            otherFiles.push(file);
          }
        }
      }
    }

    const orderedFiles = [...filesSameNameAsDir, ...otherFiles, ...directories];

    for (const file of orderedFiles) {
      const filePath = path + "/" + file.name;
      if (file.isDirectory()) {
        await traverse(filePath);
      } else {
        // if file is markdown
        if (filePath.endsWith(".md")) {
          const fileName = file.name;
          const filePathWithoutExtension = fileName.split(".md")[0];
          const markdown = fs.readFileSync(filePath, "utf-8");
          const converter = new showdown.Converter();
          let html = converter.makeHtml(markdown);

          const mentionsThatMatchPage =
            mentions[filePathWithoutExtension] || [];

          if (mentionsThatMatchPage.length > 0) {
            html =
              html +
              `<h4>Mentions</h4><ul class="mentions">` +
              mentionsThatMatchPage
                .map((mention) => {
                  return `<li><a href="#${mention.source}"><b>${mention.source}</b></a> - "${mention.snippet}"</li>`;
                })
                .join("") +
              "</ul>";
          }

          //surround with span with anchor link
          const spanBoundHtml = `<span id="${file.name}">${html}</span>`;

          // replace anythign that looks like [[anchor]] with a link to the anchor

          const replacedHtml = spanBoundHtml.replace(
            /\[\[(.*?)\]\]/g,
            (match, p1) => {
              return `<a href="#${p1}">${p1}</a>`;
            }
          );

          const subOntologies = generateSubOntologies(
            parentChilds,
            filePathWithoutExtension
          );

          const fileNameSameAsDirectory = fileName === chapterTitle + ".md";

          const withTitle = `<h3 id="${filePathWithoutExtension}">${filePathWithoutExtension}</h3>${replacedHtml}`;

          fs.appendFileSync(
            outputHTMLFile,
            fileNameSameAsDirectory ? replacedHtml : withTitle
          );

          if (subOntologies.length > 0) {
            fs.appendFileSync(
              outputHTMLFile,
              `<h4>Sub Ontologies for ${filePathWithoutExtension}</h4><ul class="sub-ontologies">` +
                Array.from(
                  new Set(
                    subOntologies.map((subOntology) => {
                      return `<li>${subOntology.join(" -> ")}</li>`;
                    })
                  )
                ).join("") +
                "</ul>"
            );
          }
        }
      }
    }
  };

  traverse(pathFromArgs);
}

generate();
