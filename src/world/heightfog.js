// Height fog for every lit material: thick and pale on the ground, thinning as it rises, drifting
// in slow banks. It replaces PlayCanvas's distance-only fog chunk (same uniforms, same function
// names), so the houses' feet vanish into moonlit mist while their towers stand clear, and the
// streets fade into it a few doors away. Global uniforms (tf_*) are set every frame by `update`.
import { SHADERLANGUAGE_GLSL, ShaderChunks } from 'playcanvas';

const FOG_GLSL = `
float dBlendModeFogFactor = 1.0;
#if (FOG != NONE)
	uniform vec3 fog_color;
	#if (FOG == LINEAR)
		uniform float fog_start;
		uniform float fog_end;
	#else
		uniform float fog_density;
	#endif
#endif
uniform float tf_ground;  // extra density at ground level
uniform float tf_falloff; // how fast that thins with height (per metre)
uniform float tf_time;
uniform vec3 tf_mist;     // colour of the low mist, lit by the moon
uniform vec4 tf_clip;     // the Specs table-top: centre x, z, radius, edge fade in metres (radius 0: no edge)

#ifdef VERTEXSHADER
	float getFogFactor(float depth) {
		float fogFactor = 0.0;
		#if (FOG == LINEAR)
			fogFactor = (fog_end - depth) / (fog_end - fog_start);
		#elif (FOG == EXP)
			fogFactor = exp(-depth * fog_density);
		#elif (FOG == EXP2)
			fogFactor = exp(-depth * depth * fog_density * fog_density);
		#endif
		return clamp(fogFactor, 0.0, 1.0);
	}
	vec3 addFog(vec3 color, float depth) {
		#if (FOG != NONE)
			return mix(fog_color * dBlendModeFogFactor, color, getFogFactor(depth));
		#endif
		return color;
	}
#else
	float tfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
	float tfNoise(vec2 p) {
		vec2 i = floor(p), f = fract(p);
		f = f * f * (3.0 - 2.0 * f);
		return mix(mix(tfHash(i), tfHash(i + vec2(1.0, 0.0)), f.x), mix(tfHash(i + vec2(0.0, 1.0)), tfHash(i + vec2(1.0, 1.0)), f.x), f.y);
	}
	// 0 near the ground, rising to 1 higher up; banks of mist drift across the village.
	float tfGround() {
		vec2 q = vPositionW.xz * 0.09;
		float banks = tfNoise(q + vec2(tf_time * 0.035, tf_time * 0.012)) * 0.65 + tfNoise(q * 2.7 - vec2(tf_time * 0.05, 0.0)) * 0.35;
		float h = max(vPositionW.y, 0.0);
		return exp(-h * tf_falloff) * (0.35 + 1.3 * banks);
	}
	float getFogFactor() {
		float depth = gl_FragCoord.z / gl_FragCoord.w;
		float fogFactor = 1.0;
		#if (FOG == LINEAR)
			fogFactor = (fog_end - depth) / (fog_end - fog_start);
		#elif (FOG == EXP)
			fogFactor = exp(-depth * fog_density);
		#elif (FOG == EXP2)
			float dens = fog_density + tf_ground * tfGround();
			fogFactor = exp(-depth * depth * dens * dens);
		#endif
		return clamp(fogFactor, 0.0, 1.0);
	}
	vec3 addFog(vec3 color) {
		#if (FOG != NONE)
			float low = exp(-max(vPositionW.y, 0.0) * tf_falloff * 0.6);
			vec3 fogCol = mix(fog_color, tf_mist, low);
			color = mix(fogCol * dBlendModeFogFactor, color, getFogFactor());
			if (tf_clip.z > 0.0) { // a round board: nothing past its edge, fading to black (clear on see-through glasses)
				float d = distance(vPositionW.xz, tf_clip.xy);
				if (d > tf_clip.z) discard;
				color *= smoothstep(tf_clip.z, tf_clip.z - tf_clip.w, d);
			}
		#endif
		return color;
	}
#endif
`;

/** Installs the height-fog chunk for every material this device builds. Call before making materials. */
export function installHeightFog(device) {
  ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('fogPS', FOG_GLSL);
  const scope = device.scope;
  const u = { ground: scope.resolve('tf_ground'), falloff: scope.resolve('tf_falloff'), time: scope.resolve('tf_time'), mist: scope.resolve('tf_mist'), clip: scope.resolve('tf_clip') };
  const mist = new Float32Array(3), clip = new Float32Array(4);
  u.clip.setValue(clip);
  return {
    /** The Specs board: only what lies within `radius` of (x, z) is drawn, the last `fade` metres darkening. */
    clip(x, z, radius, fade) { clip.set([x, z, radius, fade]); u.clip.setValue(clip); },
    /** ground: extra density at ground level; falloff: per metre; mist: [r, g, b]. */
    update(time, { ground, falloff, color }) {
      u.time.setValue(time % 1000);
      u.ground.setValue(ground);
      u.falloff.setValue(falloff);
      mist.set(color);
      u.mist.setValue(mist);
    },
  };
}
