import { useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { useI18n } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';

/** Password input used by sensitive Privacy actions.
 *
 * Visibility is local presentation state only: the password remains hidden by
 * default and the existing authenticated reset/delete requests stay unchanged.
 */
export function PasswordVisibilityField({
  style,
  testID,
  ...props
}: Omit<TextInputProps, 'secureTextEntry'> & {
  style?: StyleProp<TextStyle>;
  testID: string;
}) {
  const { t } = useI18n();
  const { colors: c } = useTokens();
  const [visible, setVisible] = useState(false);
  const visibilityLabel = t(visible ? 'auth.hidePassword' : 'auth.showPassword');

  return (
    <View style={{ position: 'relative', justifyContent: 'center' }}>
      <TextInput
        {...props}
        style={[style, { paddingEnd: 54 }]}
        secureTextEntry={!visible}
        autoCapitalize="none"
        accessibilityLabel={props.accessibilityLabel ?? props.placeholder}
        testID={testID}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visibilityLabel}
        accessibilityState={{ expanded: visible }}
        hitSlop={8}
        onPress={() => setVisible((current) => !current)}
        style={({ pressed }) => ({
          position: 'absolute',
          end: 5,
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.72 : 1,
        })}
        testID={`${testID}-visibility`}
      >
        <Text style={{ color: c.textMuted, fontSize: 18 }}>{visible ? '🙈' : '👁'}</Text>
      </Pressable>
    </View>
  );
}
