import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);
gsap.defaults({ ease: 'power3.out', duration: 0.6 });
// Financial UIs resize a lot (sidebar collapse, charts); debounce refreshes.
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger, SplitText };
