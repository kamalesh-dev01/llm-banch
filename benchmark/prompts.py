"""
Test prompts for the LLM Bench benchmarking runner.
Contains three standardized prompts:
  - short: Two-sentence neural network explanation request.
  - medium: A ~120-word paragraph on climate change followed by a 3-bullet summary request.
  - long: A ~350-word historical passage on computing milestones followed by an analysis request.
"""

PROMPTS: dict[str, str] = {
    "short": "Explain what a neural network is in two sentences.",
    "medium": (
        "Climate change represents one of the most urgent ecological and socioeconomic challenges "
        "of the modern era. Driven primarily by anthropogenic greenhouse gas emissions, such as "
        "carbon dioxide and methane resulting from fossil fuel combustion and widespread deforestation, "
        "global surface temperatures have risen substantially since the pre-industrial baseline. "
        "This continuous warming accelerates polar ice cap melt, drives sea level rise, and intensifies "
        "extreme weather events, including unprecedented droughts, severe wildfires, and devastating "
        "hurricanes. Beyond environmental destruction, shifting weather patterns jeopardize global "
        "food security, disrupt freshwater supplies, and threaten coastal communities with displacement. "
        "Mitigating these systemic consequences necessitates global collaboration, rapid transition "
        "toward renewable energy, sustainable land management, and substantial technological investments "
        "to reduce carbon intensity across all industrial sectors worldwide.\n\n"
        "Summarize the above in three bullet points."
    ),
    "long": (
        "The history of computing traces humanity's persistent quest to automate calculation, process "
        "information, and expand intellectual capabilities. The journey began centuries ago with mechanical "
        "calculating devices such as the abacus and Blaise Pascal's seventeenth-century mechanical calculator. "
        "However, the conceptual foundation of programmable computing emerged in the 1830s through Charles "
        "Babbage's designs for the Analytical Engine, accompanied by Ada Lovelace's pioneering work in "
        "formulating algorithms intended for execution on mechanical hardware, earning her distinction as "
        "the first computer programmer.\n\n"
        "During the mid-twentieth century, the exigencies of World War II dramatically accelerated electronic "
        "computation. Alan Turing established foundational mathematical frameworks defining universal "
        "computing machines, while cryptanalytic machinery at Bletchley Park broke wartime ciphers. Shortly "
        "thereafter, the development of early vacuum-tube electronic systems culminated in landmark machines "
        "like the ENIAC in 1945 and the universal stored-program architecture conceptualized by John von "
        "Neumann. The von Neumann architecture, which stored both instructions and operational data in "
        "unified memory, remains the architectural cornerstone of modern digital computing.\n\n"
        "A monumental revolution arrived in 1947 with the invention of the point-contact transistor at Bell "
        "Laboratories by John Bardeen, Walter Brattain, and William Shockley. Replacing fragile, power-hungry "
        "vacuum tubes with reliable solid-state semiconductors enabled unprecedented miniaturization and "
        "computational efficiency. This breakthrough led directly to Robert Noyce and Jack Kilby's independent "
        "invention of the integrated circuit in the late 1950s, which consolidated entire electronic circuits "
        "onto miniature silicon substrates.\n\n"
        "By the 1970s, Ted Hoff and Federico Faggin at Intel developed the microprocessor—an entire central "
        "processing unit integrated onto a single silicon chip—ushering in the personal computer revolution "
        "led by Apple, Commodore, and IBM. Concurrently, the creation of ARPANET in 1969 established "
        "packet-switching principles that evolved into the global internet. The subsequent advent of the "
        "World Wide Web by Tim Berners-Lee in 1989 democratized information access worldwide. In contemporary "
        "times, the convergence of distributed cloud computing, specialized graphics processing units, "
        "and high-performance machine learning accelerators has ignited an artificial intelligence renaissance, "
        "continuing an evolutionary trajectory from mechanical gears to modern silicon intelligence. Today, "
        "emerging paradigms like quantum computing and neuromorphic architectures represent the next "
        "frontier in this computational journey.\n\n"
        "List the five most important milestones mentioned and why."
    ),
}

# Alias for direct import compatibility
prompts = PROMPTS
