import { Image, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  SUPPORTED_LANGUAGES,
  toSupportedLanguage,
} from '@second-brain/shared';
import { localFlagSvg } from '../../assets/flags';
import { LOCAL_FLAG_PNG_BY_REGION } from '../../assets/flags/native';

/**
 * One deterministic flag renderer for Web and native surfaces.
 *
 * The adjacent native language name is the semantic label in selectors, so a
 * flag is decorative by default. Callers can opt into an accessibility label
 * only when the flag is rendered without accompanying text.
 */
export function LanguageFlag({
  code,
  size = 24,
  accessible = false,
  style,
}: {
  code: string;
  size?: number;
  accessible?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const supported = toSupportedLanguage(code);
  const language = supported ? SUPPORTED_LANGUAGES[supported] : null;
  const region = language?.flagRegion;
  const svgUri = region ? localFlagSvg(region) : null;
  const source = region
    ? Platform.OS === 'web'
      ? svgUri ? { uri: svgUri } : null
      : LOCAL_FLAG_PNG_BY_REGION[region] ?? null
    : null;
  const width = Math.round(size * 1.5);

  return (
    <View
      accessible={accessible}
      accessibilityLabel={accessible && language ? `${language.name} (${language.flagRegion})` : undefined}
      accessibilityElementsHidden={!accessible}
      importantForAccessibility={accessible ? 'yes' : 'no-hide-descendants'}
      style={[
        {
          width,
          height: size,
          overflow: 'hidden',
          borderRadius: Math.max(2, Math.round(size * 0.12)),
          borderWidth: 1,
          borderColor: 'rgba(15,23,42,0.16)',
          backgroundColor: '#E2E8F0',
        },
        style,
      ]}
    >
      {source ? (
        <Image
          accessible={false}
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          source={source}
          style={{ width: '100%', height: '100%' }}
        />
      ) : null}
    </View>
  );
}
