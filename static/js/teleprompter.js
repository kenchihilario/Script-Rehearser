
class Teleprompter {
    constructor(containerElement, options = {}) {
        this.container = containerElement;
        this.fontSize = options.fontSize || 28;
        this.targetWpm = options.targetWpm || 140;
        this.isAutoScrolling = false;
        this.scrollSpeed = 1.0;
        this.scrollInterval = null;

        this.rawText = "";
        this.words = [];
        this.currentWordIdx = 0;
    }

    loadScript(text, targetWpm = 140) {
        this.rawText = text;
        this.targetWpm = targetWpm;
        this.currentWordIdx = 0;
        this.words = [];

        if (!this.container) return;
        this.container.innerHTML = "";
        const paragraphs = text.split(/\n\s*\n/);
        let wordGlobalIdx = 0;

        paragraphs.forEach((para, pIdx) => {
            const pElem = document.createElement("p");
            pElem.className = "prompter-paragraph";

            const rawWords = para.split(/\s+/).filter(Boolean);
            rawWords.forEach((rawW) => {
                const span = document.createElement("span");
                span.className = "prompter-word";
                span.dataset.idx = wordGlobalIdx;
                span.textContent = rawW + " ";

                this.words.push({
                    index: wordGlobalIdx,
                    raw: rawW,
                    clean: rawW.toLowerCase().replace(/[^\w]/g, ""),
                    element: span
                });

                pElem.appendChild(span);
                wordGlobalIdx++;
            });

            this.container.appendChild(pElem);
        });

        this.applyFontSize(this.fontSize);
        this.scrollToIndex(0);
    }

    applyFontSize(sizePx) {
        this.fontSize = sizePx;
        if (this.container) {
            this.container.style.fontSize = `${this.fontSize}px`;
        }
    }

    highlightWord(index) {
        if (index < 0 || index >= this.words.length) return;
        for (let i = 0; i <= index; i++) {
            if (this.words[i] && this.words[i].element) {
                this.words[i].element.classList.add("spoken");
            }
        }
        if (this.words[this.currentWordIdx] && this.words[this.currentWordIdx].element) {
            this.words[this.currentWordIdx].element.classList.remove("active");
        }
        if (this.words[index] && this.words[index].element) {
            this.words[index].element.classList.add("active");
            this.currentWordIdx = index;
            this.scrollToWord(this.words[index].element);
        }
    }

    scrollToWord(element) {
        if (!element || !this.container) return;
        const containerRect = this.container.getBoundingClientRect();
        const elemRect = element.getBoundingClientRect();

        const relativeTop = elemRect.top - containerRect.top + this.container.scrollTop;
        const targetScroll = relativeTop - (containerRect.height * 0.35);

        this.container.scrollTo({
            top: Math.max(0, targetScroll),
            behavior: "smooth"
        });
    }

    scrollToIndex(index) {
        if (this.words[index] && this.words[index].element) {
            this.scrollToWord(this.words[index].element);
        } else if (this.container) {
            this.container.scrollTop = 0;
        }
    }

    reset() {
        this.stopAutoScroll();
        this.currentWordIdx = 0;
        this.words.forEach(w => {
            if (w.element) {
                w.element.classList.remove("spoken", "active");
            }
        });
        if (this.container) {
            this.container.scrollTop = 0;
        }
    }

    startAutoScroll(wpm = 140) {
        this.stopAutoScroll();
        this.isAutoScrolling = true;
        const pxPerSec = (wpm / 140) * 24 * this.scrollSpeed;
        const intervalMs = 25;
        const pxPerTick = pxPerSec * (intervalMs / 1000);

        this.scrollInterval = setInterval(() => {
            if (this.container && this.isAutoScrolling) {
                this.container.scrollTop += pxPerTick;
            }
        }, intervalMs);
    }

    stopAutoScroll() {
        this.isAutoScrolling = false;
        if (this.scrollInterval) {
            clearInterval(this.scrollInterval);
            this.scrollInterval = null;
        }
    }

    getStats() {
        const totalWords = this.words.length;
        const estSec = totalWords ? Math.round((totalWords / this.targetWpm) * 60) : 0;
        const mins = Math.floor(estSec / 60);
        const secs = estSec % 60;
        const timeFormatted = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

        return {
            totalWords: totalWords,
            estimatedDurationFormatted: timeFormatted,
            targetWpm: this.targetWpm
        };
    }
}

window.Teleprompter = Teleprompter;
