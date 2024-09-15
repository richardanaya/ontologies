gen: clean
	npx ts-node generate.ts ../Existence
	# pandoc -o ontologies.epub --css=tufte.css -V fontsize=10pt --metadata author="Richard E. Anaya II"  ontologies.html 
clean:
	rm ontologies.epub || true
	rm ontologies.html || true