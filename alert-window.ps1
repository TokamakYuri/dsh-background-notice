# Native Windows choice window for the dsh-background-notice plugin.
# Reads one JSON payload from stdin and writes exactly one result line prefixed
# with ###RESULT### to stdout. Closing or cancelling writes {"cancelled":true}.
$ErrorActionPreference = 'Stop'

try {
  Add-Type -AssemblyName PresentationFramework
  Add-Type -AssemblyName PresentationCore
  Add-Type -AssemblyName WindowsBase
} catch {
  [Console]::Error.WriteLine("dsh-background-notice: WPF unavailable: $($_.Exception.Message)")
  exit 3
}

# Crisp text on high-DPI displays; ignore failures on older systems.
try {
  Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class DshBackgroundNoticeDpi {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
'@
  [DshBackgroundNoticeDpi]::SetProcessDPIAware() | Out-Null
} catch { }

[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

$script:finished = $false
$script:mode = 'questions'
$script:questionStates = New-Object System.Collections.ArrayList

function Write-Result([string]$json) {
  [Console]::Out.Write("###RESULT###$json")
  [Console]::Out.Flush()
}

function Write-Cancelled {
  if ($script:finished) { return }
  $script:finished = $true
  Write-Result '{"cancelled":true}'
}

$raw = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($raw)) {
  Write-Cancelled
  exit 2
}

try {
  $payload = $raw | ConvertFrom-Json
} catch {
  [Console]::Error.WriteLine("dsh-background-notice: invalid dialog payload: $($_.Exception.Message)")
  Write-Cancelled
  exit 2
}

$chinese = $PSUICulture -like 'zh*'
function L([string]$zh, [string]$en) {
  if ($chinese) { return $zh }
  return $en
}

function New-Brush([string]$hex) {
  return (New-Object System.Windows.Media.BrushConverter).ConvertFromString($hex)
}

$script:light = 1
try {
  $script:light = [int](Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' -Name AppsUseLightTheme -ErrorAction Stop).AppsUseLightTheme
} catch { $script:light = 1 }

$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        x:Name="RootWindow"
        Width="600"
        SizeToContent="Height"
        WindowStartupLocation="CenterScreen"
        ResizeMode="NoResize"
        ShowInTaskbar="True"
        Topmost="True"
        UseLayoutRounding="True"
        SnapsToDevicePixels="True"
        FontFamily="Segoe UI"
        FontSize="13"
        Background="{DynamicResource BgBrush}"
        Foreground="{DynamicResource TextBrush}">
  <Window.Resources>
    <SolidColorBrush x:Key="BgBrush" Color="#FFFFFF"/>
    <SolidColorBrush x:Key="PanelBrush" Color="#F6F7F9"/>
    <SolidColorBrush x:Key="TextBrush" Color="#1B1F24"/>
    <SolidColorBrush x:Key="MutedBrush" Color="#5B6572"/>
    <SolidColorBrush x:Key="LineBrush" Color="#E4E7EB"/>
    <SolidColorBrush x:Key="AccentBrush" Color="#247BBF"/>
    <SolidColorBrush x:Key="AccentHoverBrush" Color="#1E6AA8"/>
    <SolidColorBrush x:Key="DangerBrush" Color="#C43C3C"/>
    <SolidColorBrush x:Key="OptionHoverBrush" Color="#EEF1F4"/>

    <Style x:Key="PrimaryButton" TargetType="Button">
      <Setter Property="Foreground" Value="#FFFFFF"/>
      <Setter Property="Background" Value="{DynamicResource AccentBrush}"/>
      <Setter Property="BorderThickness" Value="0"/>
      <Setter Property="Padding" Value="18,8"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="Bd" Background="{TemplateBinding Background}" CornerRadius="8" Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="Bd" Property="Background" Value="{DynamicResource AccentHoverBrush}"/>
              </Trigger>
              <Trigger Property="IsPressed" Value="True">
                <Setter Property="Opacity" Value="0.85"/>
              </Trigger>
              <Trigger Property="IsEnabled" Value="False">
                <Setter Property="Opacity" Value="0.45"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>

    <Style x:Key="SecondaryButton" TargetType="Button">
      <Setter Property="Foreground" Value="{DynamicResource TextBrush}"/>
      <Setter Property="Background" Value="Transparent"/>
      <Setter Property="BorderBrush" Value="{DynamicResource LineBrush}"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="Padding" Value="18,8"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="Bd" Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="{TemplateBinding BorderThickness}" CornerRadius="8" Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="Bd" Property="Background" Value="{DynamicResource OptionHoverBrush}"/>
              </Trigger>
              <Trigger Property="IsEnabled" Value="False">
                <Setter Property="Opacity" Value="0.45"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
  </Window.Resources>

  <Border Padding="24">
    <Grid>
      <Grid.RowDefinitions>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="Auto"/>
      </Grid.RowDefinitions>

      <TextBlock x:Name="CaptionText" Grid.Row="0" Foreground="{DynamicResource MutedBrush}" FontSize="12" TextTrimming="CharacterEllipsis"/>
      <TextBlock x:Name="TitleText" Grid.Row="1" FontSize="18" FontWeight="SemiBold" TextWrapping="Wrap" Margin="0,6,0,0"/>
      <TextBlock x:Name="SubtitleText" Grid.Row="2" Foreground="{DynamicResource MutedBrush}" FontSize="12.5" TextWrapping="Wrap" Margin="0,6,0,0" Visibility="Collapsed"/>

      <ScrollViewer x:Name="ContentScroll" Grid.Row="3" Margin="0,16,0,0" MaxHeight="440" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled">
        <StackPanel x:Name="ContentPanel"/>
      </ScrollViewer>

      <TextBlock x:Name="HintText" Grid.Row="4" Foreground="{DynamicResource DangerBrush}" FontSize="12" TextWrapping="Wrap" Margin="0,10,0,0" Visibility="Collapsed"/>

      <StackPanel Grid.Row="5" Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,18,0,0">
        <Button x:Name="CancelButton" Style="{StaticResource SecondaryButton}" MinWidth="88" IsCancel="True"/>
        <Button x:Name="SubmitButton" Style="{StaticResource PrimaryButton}" MinWidth="108" Margin="10,0,0,0" IsDefault="True"/>
      </StackPanel>
    </Grid>
  </Border>
</Window>
'@

$window = [Windows.Markup.XamlReader]::Parse($xaml)

if ($script:light -eq 0) {
  $window.Resources['BgBrush'] = New-Brush '#232427'
  $window.Resources['PanelBrush'] = New-Brush '#2C2E32'
  $window.Resources['TextBrush'] = New-Brush '#F2F4F7'
  $window.Resources['MutedBrush'] = New-Brush '#A6ADB8'
  $window.Resources['LineBrush'] = New-Brush '#3B3E44'
  $window.Resources['AccentBrush'] = New-Brush '#4C9EE0'
  $window.Resources['AccentHoverBrush'] = New-Brush '#67B2EE'
  $window.Resources['DangerBrush'] = New-Brush '#E06C6C'
  $window.Resources['OptionHoverBrush'] = New-Brush '#34363B'
  $window.FindName('SubmitButton').Foreground = New-Brush '#0B0E11'
}

$captionText = $window.FindName('CaptionText')
$titleText = $window.FindName('TitleText')
$subtitleText = $window.FindName('SubtitleText')
$contentPanel = $window.FindName('ContentPanel')
$hintText = $window.FindName('HintText')
$cancelButton = $window.FindName('CancelButton')
$submitButton = $window.FindName('SubmitButton')

function Set-Hint([string]$text) {
  if ([string]::IsNullOrEmpty($text)) {
    $hintText.Visibility = 'Collapsed'
    $hintText.Text = ''
  } else {
    $hintText.Text = $text
    $hintText.Visibility = 'Visible'
  }
}

function Finish-Questions {
  if ($script:finished) { return }
  $answers = New-Object System.Collections.ArrayList
  foreach ($state in $script:questionStates) {
    $selected = New-Object System.Collections.ArrayList
    foreach ($entry in $state.Controls) {
      if ($entry.Control.IsChecked -eq $true) { [void]$selected.Add($entry.Label) }
    }
    $text = ''
    if ($null -ne $state.TextBox) { $text = ([string]$state.TextBox.Text).Trim() }

    if ($state.Controls.Count -eq 0) {
      if ([string]::IsNullOrWhiteSpace($text)) {
        Set-Hint (L '请先填写回答，再点击“确定”。' 'Type an answer before submitting.')
        return
      }
      [void]$answers.Add(@{ id = $state.Id; selected = @(); custom = $text })
      continue
    }

    if ($state.MultiSelect) {
      if ($selected.Count -eq 0 -and [string]::IsNullOrWhiteSpace($text)) {
        Set-Hint (L '请至少选择一项或输入文字，再点击“确定”。' 'Select an option or type an answer before submitting.')
        return
      }
      $item = @{ id = $state.Id; selected = @($selected) }
      if (-not [string]::IsNullOrWhiteSpace($text)) { $item.custom = $text }
      [void]$answers.Add($item)
      continue
    }

    # Typed text is the user's own option and overrides a radio selection.
    if (-not [string]::IsNullOrWhiteSpace($text)) {
      [void]$answers.Add(@{ id = $state.Id; selected = @(); custom = $text })
      continue
    }
    if ($selected.Count -ne 1) {
      Set-Hint (L '请选择一个选项，或直接输入你的回答。' 'Select an option or type your own answer.')
      return
    }
    [void]$answers.Add(@{ id = $state.Id; selected = @($selected) })
  }
  $script:finished = $true
  $json = @{ answers = @($answers) } | ConvertTo-Json -Compress -Depth 8
  Write-Result $json
  $window.Close()
}

function Finish-Approval([string]$outcome) {
  if ($script:finished) { return }
  $script:finished = $true
  $json = @{ outcome = $outcome } | ConvertTo-Json -Compress -Depth 8
  Write-Result $json
  $window.Close()
}

function Invoke-Cancel {
  if ($script:finished) { return }
  $script:finished = $true
  Write-Result '{"cancelled":true}'
  $window.Close()
}

function Get-DisplayReason {
  $display = $payload.displayReason
  if ($null -eq $display) { return [string]$payload.reason }
  if ($chinese) {
    foreach ($key in $display.PSObject.Properties.Name) {
      if ($key -like 'zh*' -and -not [string]::IsNullOrWhiteSpace([string]$display.$key)) { return [string]$display.$key }
    }
  }
  foreach ($key in $display.PSObject.Properties.Name) {
    if ($key -like 'en*' -and -not [string]::IsNullOrWhiteSpace([string]$display.$key)) { return [string]$display.$key }
  }
  foreach ($key in $display.PSObject.Properties.Name) {
    if (-not [string]::IsNullOrWhiteSpace([string]$display.$key)) { return [string]$display.$key }
  }
  return [string]$payload.reason
}

function New-QuestionGroup($question) {
  $group = New-Object System.Windows.Controls.Border
  $group.CornerRadius = '10'
  $group.BorderThickness = '1'
  $group.BorderBrush = $window.Resources['LineBrush']
  $group.Background = $window.Resources['PanelBrush']
  $group.Padding = '14'
  $group.Margin = '0,0,0,12'

  $stack = New-Object System.Windows.Controls.StackPanel
  $group.Child = $stack

  if (-not [string]::IsNullOrWhiteSpace([string]$question.header)) {
    $headerBlock = New-Object System.Windows.Controls.TextBlock
    $headerBlock.Text = [string]$question.header
    $headerBlock.FontSize = 12
    $headerBlock.FontWeight = 'SemiBold'
    $headerBlock.Foreground = $window.Resources['AccentBrush']
    [void]$stack.Children.Add($headerBlock)
  }

  $titleBlock = New-Object System.Windows.Controls.TextBlock
  $titleBlock.Text = [string]$question.question
  $titleBlock.FontSize = 15
  $titleBlock.FontWeight = 'SemiBold'
  $titleBlock.TextWrapping = 'Wrap'
  $titleBlock.Margin = '0,4,0,0'
  [void]$stack.Children.Add($titleBlock)

  if (-not [string]::IsNullOrWhiteSpace([string]$question.detail)) {
    $detailBlock = New-Object System.Windows.Controls.TextBlock
    $detailBlock.Text = [string]$question.detail
    $detailBlock.FontSize = 12.5
    $detailBlock.TextWrapping = 'Wrap'
    $detailBlock.Foreground = $window.Resources['MutedBrush']
    $detailBlock.Margin = '0,6,0,0'
    [void]$stack.Children.Add($detailBlock)
  }

  $options = @($question.options | Where-Object { $null -ne $_ })
  $controls = New-Object System.Collections.ArrayList
  $textBox = $null

  if ($options.Count -gt 0) {
    $multi = ($question.multiSelect -eq $true)
    $optionPanel = New-Object System.Windows.Controls.StackPanel
    $optionPanel.Margin = '0,10,0,0'
    foreach ($option in $options) {
      $row = New-Object System.Windows.Controls.Border
      $row.CornerRadius = '8'
      $row.Padding = '10,8'
      $row.Margin = '0,2,0,2'
      $row.Background = [System.Windows.Media.Brushes]::Transparent
      $row.Cursor = 'Hand'

      if ($multi) {
        $choice = New-Object System.Windows.Controls.CheckBox
      } else {
        $choice = New-Object System.Windows.Controls.RadioButton
        $choice.GroupName = "q_$([string]$question.id)"
      }
      $choice.VerticalContentAlignment = 'Top'
      $choice.Background = [System.Windows.Media.Brushes]::Transparent

      $choiceContent = New-Object System.Windows.Controls.StackPanel
      $labelBlock = New-Object System.Windows.Controls.TextBlock
      $labelBlock.Text = [string]$option.label
      $labelBlock.TextWrapping = 'Wrap'
      $labelBlock.FontSize = 13.5
      [void]$choiceContent.Children.Add($labelBlock)
      if (-not [string]::IsNullOrWhiteSpace([string]$option.description)) {
        $descBlock = New-Object System.Windows.Controls.TextBlock
        $descBlock.Text = [string]$option.description
        $descBlock.TextWrapping = 'Wrap'
        $descBlock.FontSize = 12
        $descBlock.Foreground = $window.Resources['MutedBrush']
        $descBlock.Margin = '0,2,0,0'
        [void]$choiceContent.Children.Add($descBlock)
      }
      $choice.Content = $choiceContent
      $row.Child = $choice

      $row.Tag = $choice
      if ($multi) {
        $row.Add_MouseLeftButtonUp({ param($sender, $eventArgs) $sender.Tag.IsChecked = -not $sender.Tag.IsChecked })
      } else {
        $row.Add_MouseLeftButtonUp({ param($sender, $eventArgs) $sender.Tag.IsChecked = $true })
      }
      $row.Add_MouseEnter({ param($sender, $eventArgs) $sender.Background = $window.Resources['OptionHoverBrush'] })
      $row.Add_MouseLeave({ param($sender, $eventArgs) $sender.Background = [System.Windows.Media.Brushes]::Transparent })

      [void]$optionPanel.Children.Add($row)
      [void]$controls.Add(@{ Label = [string]$option.label; Control = $choice })
    }
    [void]$stack.Children.Add($optionPanel)
  }

  $customHint = L '输入你的回答' 'Type your answer'
  if ($options.Count -gt 0) {
    if ($question.multiSelect -eq $true) {
      $customHint = L '补充输入（可选）' 'Additional text (optional)'
    } else {
      $customHint = L '或其他：直接输入你的回答（优先于上方选择）' 'Or type your own answer (takes precedence)'
    }
  }
  $customHintBlock = New-Object System.Windows.Controls.TextBlock
  $customHintBlock.Text = $customHint
  $customHintBlock.FontSize = 12
  $customHintBlock.Foreground = $window.Resources['MutedBrush']
  $customHintBlock.Margin = '0,10,0,0'
  [void]$stack.Children.Add($customHintBlock)

  $textBox = New-Object System.Windows.Controls.TextBox
  $textBox.Padding = '10,8'
  $textBox.FontSize = 13.5
  $textBox.TextWrapping = 'Wrap'
  $textBox.AcceptsReturn = $true
  $textBox.MinHeight = '40'
  $textBox.MaxHeight = '140'
  $textBox.Margin = '0,6,0,0'
  $textBox.Background = $window.Resources['BgBrush']
  $textBox.Foreground = $window.Resources['TextBrush']
  $textBox.BorderBrush = $window.Resources['LineBrush']
  $textBox.VerticalScrollBarVisibility = 'Auto'
  $textBox.ToolTip = L '直接输入你的回答' 'Type your own answer'
  [void]$stack.Children.Add($textBox)

  [void]$script:questionStates.Add(@{
    Id = [string]$question.id
    MultiSelect = ($question.multiSelect -eq $true)
    Controls = $controls
    TextBox = $textBox
  })
  return $group
}

$script:mode = 'questions'
if ([string]$payload.kind -eq 'approval') { $script:mode = 'approval' }

if ($script:mode -eq 'approval') {
  $window.Title = L '工具执行审批' 'Tool approval'
  $titleText.Text = L '工具执行审批' 'Tool approval'
  $subtitleText.Text = L '这次工具调用需要你的确认。' 'This tool call needs your confirmation.'
  $subtitleText.Visibility = 'Visible'

  $card = New-Object System.Windows.Controls.Border
  $card.CornerRadius = '10'
  $card.BorderThickness = '1'
  $card.BorderBrush = $window.Resources['LineBrush']
  $card.Background = $window.Resources['PanelBrush']
  $card.Padding = '14'

  $cardStack = New-Object System.Windows.Controls.StackPanel
  $card.Child = $cardStack

  $toolLabel = New-Object System.Windows.Controls.TextBlock
  $toolLabel.Text = L '工具' 'Tool'
  $toolLabel.FontSize = 12
  $toolLabel.Foreground = $window.Resources['MutedBrush']
  [void]$cardStack.Children.Add($toolLabel)

  $toolBlock = New-Object System.Windows.Controls.TextBlock
  $toolBlock.Text = [string]$payload.toolName
  $toolBlock.FontFamily = 'Consolas'
  $toolBlock.FontSize = 14.5
  $toolBlock.FontWeight = 'SemiBold'
  $toolBlock.TextWrapping = 'Wrap'
  $toolBlock.Margin = '0,2,0,0'
  [void]$cardStack.Children.Add($toolBlock)

  $reasonText = Get-DisplayReason
  if (-not [string]::IsNullOrWhiteSpace($reasonText)) {
    $reasonBlock = New-Object System.Windows.Controls.TextBlock
    $reasonBlock.Text = $reasonText
    $reasonBlock.TextWrapping = 'Wrap'
    $reasonBlock.FontSize = 12.5
    $reasonBlock.Foreground = $window.Resources['MutedBrush']
    $reasonBlock.Margin = '0,8,0,0'
    [void]$cardStack.Children.Add($reasonBlock)
  }

  [void]$contentPanel.Children.Add($card)

  $cancelButton.Content = L '拒绝' 'Reject'
  $cancelButton.Foreground = $window.Resources['DangerBrush']
  $submitButton.Content = L '允许一次' 'Allow once'
  $submitButton.Add_Click({ Finish-Approval 'allowed-once' })
  $cancelButton.Add_Click({ Finish-Approval 'rejected' })
} else {
  $window.Title = L '需要你的选择' 'Your input is needed'
  $titleText.Text = L '需要你的选择' 'Your input is needed'

  $questions = @($payload.questions | Where-Object { $null -ne $_ })
  foreach ($question in $questions) {
    [void]$contentPanel.Children.Add((New-QuestionGroup $question))
  }

  $cancelButton.Content = L '取消' 'Cancel'
  $submitButton.Content = L '确定' 'Submit'
  $submitButton.Add_Click({ Finish-Questions })
  $cancelButton.Add_Click({ Invoke-Cancel })
}

$captionText.Text = ''
if (-not [string]::IsNullOrWhiteSpace([string]$payload.sessionId)) {
  $captionText.Text = (L '会话 ' 'Session ') + [string]$payload.sessionId
}

$window.Add_Closing({
  if (-not $script:finished) {
    $script:finished = $true
    Write-Result '{"cancelled":true}'
  }
})

$window.Add_Loaded({
  $window.Activate() | Out-Null
  try {
    if ($script:mode -eq 'approval') {
      [System.Media.SystemSounds]::Exclamation.Play()
    } else {
      [System.Media.SystemSounds]::Asterisk.Play()
    }
  } catch { }

  if ($script:mode -eq 'approval') {
    $submitButton.Focus() | Out-Null
  } elseif ($script:questionStates.Count -gt 0 -and $script:questionStates[0].Controls.Count -gt 0) {
    $script:questionStates[0].Controls[0].Control.Focus() | Out-Null
  } else {
    $submitButton.Focus() | Out-Null
  }

  if ($payload.autoAnswer -eq $true -or $payload.autoCustom -eq $true) {
    $script:autoTimer = New-Object System.Windows.Threading.DispatcherTimer
    $script:autoTimer.Interval = [TimeSpan]::FromMilliseconds(500)
    $script:autoTimer.Add_Tick({
      $script:autoTimer.Stop()
      if ($script:mode -eq 'approval') {
        Finish-Approval 'allowed-once'
        return
      }
      if ($payload.autoCustom -eq $true) {
        $autoText = 'auto custom'
        if ($null -ne $payload.autoCustomText) { $autoText = [string]$payload.autoCustomText }
        foreach ($state in $script:questionStates) {
          if ($null -ne $state.TextBox) { $state.TextBox.Text = $autoText }
        }
        Finish-Questions
        return
      }
      foreach ($state in $script:questionStates) {
        if ($state.Controls.Count -gt 0) {
          $state.Controls[0].Control.IsChecked = $true
        } elseif ($null -ne $state.TextBox) {
          $state.TextBox.Text = 'auto'
        }
      }
      Finish-Questions
    })
    $script:autoTimer.Start()
  }
})

try {
  $window.ShowDialog() | Out-Null
} finally {
  if (-not $script:finished) {
    $script:finished = $true
    Write-Result '{"cancelled":true}'
  }
}
exit 0
